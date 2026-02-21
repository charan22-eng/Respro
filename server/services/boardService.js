/**
 * Board Service
 * Kanban board persistence and deadline management
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const PLAYBOOK_DIR = process.env.PLAYBOOK_DIR || path.join(process.cwd(), 'playbooks');

function getRepoDir(owner, repo) {
  return path.join(PLAYBOOK_DIR, `${owner}-${repo}`);
}

function getBoardPath(owner, repo) {
  return path.join(getRepoDir(owner, repo), 'board.json');
}

/**
 * Create an empty board structure
 */
function createEmptyBoard(owner, repo) {
  return {
    repoFullName: `${owner}/${repo}`,
    lastUpdated: new Date().toISOString(),
    columns: ['todo', 'in_progress', 'in_review', 'done'],
    tasks: [],
    flags: []
  };
}

/**
 * Calculate days difference between two dates
 */
function daysDiff(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return Math.floor((d1 - d2) / (1000 * 60 * 60 * 24));
}

/**
 * Compute deadline statuses for all tasks and auto-flag overdue ones
 */
export function computeDeadlineStatuses(board) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const existingFlagTaskIds = new Set(board.flags.map(f => f.taskId));
  
  for (const task of board.tasks) {
    if (!task.deadline) {
      task.deadlineStatus = 'on_track';
      continue;
    }
    
    const deadline = new Date(task.deadline);
    deadline.setHours(0, 0, 0, 0);
    const daysRemaining = daysDiff(deadline, today);
    
    // Tasks in "done" column are never flagged or marked overdue
    if (task.column === 'done') {
      task.deadlineStatus = 'on_track';
      task.flagged = false;
      continue;
    }
    
    if (daysRemaining < 0) {
      // Overdue
      task.deadlineStatus = 'overdue';
      task.flagged = true;
      
      // Add to flags array if not already there
      if (!existingFlagTaskIds.has(task.id)) {
        board.flags.push({
          taskId: task.id,
          assignee: task.assignee,
          taskTitle: task.title,
          deadline: task.deadline,
          daysOverdue: Math.abs(daysRemaining),
          flaggedAt: new Date().toISOString()
        });
        existingFlagTaskIds.add(task.id);
      } else {
        // Update daysOverdue in existing flag
        const existingFlag = board.flags.find(f => f.taskId === task.id);
        if (existingFlag) {
          existingFlag.daysOverdue = Math.abs(daysRemaining);
        }
      }
    } else if (daysRemaining <= 2) {
      // Approaching (within 2 days)
      task.deadlineStatus = 'approaching';
    } else {
      // On track
      task.deadlineStatus = 'on_track';
    }
  }
  
  board.lastUpdated = new Date().toISOString();
  return board;
}

/**
 * Load board from disk, create if doesn't exist
 */
export async function loadBoard(owner, repo) {
  const boardPath = getBoardPath(owner, repo);
  
  try {
    const data = await fs.readFile(boardPath, 'utf-8');
    const board = JSON.parse(data);
    return computeDeadlineStatuses(board);
  } catch (err) {
    if (err.code === 'ENOENT') {
      // Board doesn't exist, create empty one
      const board = createEmptyBoard(owner, repo);
      await saveBoard(owner, repo, board);
      return board;
    }
    throw err;
  }
}

/**
 * Save board to disk
 */
export async function saveBoard(owner, repo, board) {
  const repoDir = getRepoDir(owner, repo);
  await fs.mkdir(repoDir, { recursive: true });
  
  board.lastUpdated = new Date().toISOString();
  await fs.writeFile(getBoardPath(owner, repo), JSON.stringify(board, null, 2));
}

/**
 * Get all flags for a specific contributor
 */
export function getContributorFlags(board, username) {
  return board.flags.filter(f => f.assignee === username);
}

/**
 * Get board warnings (approaching and overdue tasks)
 */
export function getBoardWarnings(board) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return board.tasks
    .filter(t => t.deadlineStatus === 'approaching' || t.deadlineStatus === 'overdue')
    .map(t => {
      const deadline = new Date(t.deadline);
      deadline.setHours(0, 0, 0, 0);
      const daysRemaining = daysDiff(deadline, today);
      
      return {
        taskId: t.id,
        title: t.title,
        assignee: t.assignee,
        deadline: t.deadline,
        deadlineStatus: t.deadlineStatus,
        daysRemaining,
        column: t.column,
        priority: t.priority
      };
    })
    .sort((a, b) => a.daysRemaining - b.daysRemaining); // Soonest/most overdue first
}

/**
 * Create a new task
 */
export async function createTask(owner, repo, taskData, createdBy) {
  const board = await loadBoard(owner, repo);
  
  const task = {
    id: crypto.randomUUID(),
    title: taskData.title,
    description: taskData.description || '',
    column: 'todo',
    priority: taskData.priority || 'medium',
    deadline: taskData.deadline,
    assignee: createdBy, // Self-assign only
    createdBy,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    labels: taskData.labels || [],
    linkedPR: taskData.linkedPR || null,
    linkedCommits: [],
    deadlineStatus: 'on_track',
    flagged: false
  };
  
  board.tasks.push(task);
  const updatedBoard = computeDeadlineStatuses(board);
  await saveBoard(owner, repo, updatedBoard);
  
  return task;
}

/**
 * Update a task
 */
export async function updateTask(owner, repo, taskId, updates, username) {
  const board = await loadBoard(owner, repo);
  const taskIndex = board.tasks.findIndex(t => t.id === taskId);
  
  if (taskIndex === -1) {
    throw new Error('Task not found');
  }
  
  const task = board.tasks[taskIndex];
  
  // Only task owner can edit
  if (task.createdBy !== username) {
    throw new Error('Only the task creator can edit this task');
  }
  
  // Update allowed fields
  const allowedFields = ['title', 'description', 'labels', 'priority', 'deadline', 'linkedPR'];
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      task[field] = updates[field];
    }
  }
  
  task.updatedAt = new Date().toISOString();
  
  const updatedBoard = computeDeadlineStatuses(board);
  await saveBoard(owner, repo, updatedBoard);
  
  return task;
}

/**
 * Delete a task
 */
export async function deleteTask(owner, repo, taskId, username) {
  const board = await loadBoard(owner, repo);
  const taskIndex = board.tasks.findIndex(t => t.id === taskId);
  
  if (taskIndex === -1) {
    throw new Error('Task not found');
  }
  
  const task = board.tasks[taskIndex];
  
  // Only task owner can delete
  if (task.createdBy !== username) {
    throw new Error('Only the task creator can delete this task');
  }
  
  board.tasks.splice(taskIndex, 1);
  await saveBoard(owner, repo, board);
  
  return { deleted: true };
}

/**
 * Move a task to a different column
 */
export async function moveTask(owner, repo, taskId, newColumn, username) {
  const board = await loadBoard(owner, repo);
  const task = board.tasks.find(t => t.id === taskId);
  
  if (!task) {
    throw new Error('Task not found');
  }
  
  const validColumns = ['todo', 'in_progress', 'in_review', 'done'];
  if (!validColumns.includes(newColumn)) {
    throw new Error('Invalid column');
  }
  
  task.column = newColumn;
  task.updatedAt = new Date().toISOString();
  
  // If moved to done, clear flagged status (but keep flags[] log entry)
  if (newColumn === 'done') {
    task.flagged = false;
    task.deadlineStatus = 'on_track';
  }
  
  const updatedBoard = computeDeadlineStatuses(board);
  await saveBoard(owner, repo, updatedBoard);
  
  return task;
}

/**
 * Find task by linked PR number and move it
 */
export async function moveTaskByPR(owner, repo, prNumber, newColumn) {
  const board = await loadBoard(owner, repo);
  const task = board.tasks.find(t => t.linkedPR === prNumber);
  
  if (!task) {
    return null; // No matching task found
  }
  
  task.column = newColumn;
  task.updatedAt = new Date().toISOString();
  
  if (newColumn === 'done') {
    task.flagged = false;
    task.deadlineStatus = 'on_track';
  }
  
  const updatedBoard = computeDeadlineStatuses(board);
  await saveBoard(owner, repo, updatedBoard);
  
  return task;
}

export default {
  loadBoard,
  saveBoard,
  computeDeadlineStatuses,
  getContributorFlags,
  getBoardWarnings,
  createTask,
  updateTask,
  deleteTask,
  moveTask,
  moveTaskByPR
};
