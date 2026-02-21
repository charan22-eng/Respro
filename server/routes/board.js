/**
 * Board Routes
 * Kanban board API endpoints
 */

import express from 'express';
import {
  loadBoard,
  saveBoard,
  getContributorFlags,
  getBoardWarnings,
  createTask,
  updateTask,
  deleteTask,
  moveTask
} from '../services/boardService.js';

const router = express.Router();

/**
 * Auth middleware - require logged in user
 */
function requireAuth(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
  }
  next();
}

/**
 * GET /api/board/:owner/:repo
 * Get full board with computed deadline statuses
 */
router.get('/:owner/:repo', requireAuth, async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const board = await loadBoard(owner, repo);
    const warnings = getBoardWarnings(board);
    
    res.json({ board, warnings });
  } catch (error) {
    console.error('Error loading board:', error);
    res.status(500).json({ error: error.message, code: 'BOARD_LOAD_ERROR' });
  }
});

/**
 * GET /api/board/:owner/:repo/warnings
 * Get approaching and overdue tasks only
 */
router.get('/:owner/:repo/warnings', requireAuth, async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const board = await loadBoard(owner, repo);
    const warnings = getBoardWarnings(board);
    
    res.json({ warnings });
  } catch (error) {
    console.error('Error getting warnings:', error);
    res.status(500).json({ error: error.message, code: 'WARNINGS_ERROR' });
  }
});

/**
 * GET /api/board/:owner/:repo/flags
 * Get full flags ledger
 */
router.get('/:owner/:repo/flags', requireAuth, async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const board = await loadBoard(owner, repo);
    
    res.json({ flags: board.flags });
  } catch (error) {
    console.error('Error getting flags:', error);
    res.status(500).json({ error: error.message, code: 'FLAGS_ERROR' });
  }
});

/**
 * GET /api/board/:owner/:repo/flags/:username
 * Get flags for a specific contributor
 */
router.get('/:owner/:repo/flags/:username', requireAuth, async (req, res) => {
  try {
    const { owner, repo, username } = req.params;
    const board = await loadBoard(owner, repo);
    const flags = getContributorFlags(board, username);
    
    res.json({ flags });
  } catch (error) {
    console.error('Error getting contributor flags:', error);
    res.status(500).json({ error: error.message, code: 'CONTRIBUTOR_FLAGS_ERROR' });
  }
});

/**
 * POST /api/board/:owner/:repo/tasks
 * Create a new task (self-assign only)
 */
router.post('/:owner/:repo/tasks', requireAuth, async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const { title, description, priority, deadline, labels, linkedPR } = req.body;
    const username = req.session.user.login;
    
    // Validate required fields
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required', code: 'MISSING_TITLE' });
    }
    
    if (!priority || !['critical', 'high', 'medium', 'low'].includes(priority)) {
      return res.status(400).json({ error: 'Valid priority is required', code: 'INVALID_PRIORITY' });
    }
    
    if (!deadline) {
      return res.status(400).json({ error: 'Deadline is required', code: 'MISSING_DEADLINE' });
    }
    
    // Validate deadline is in the future
    const deadlineDate = new Date(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deadlineDate.setHours(0, 0, 0, 0);
    
    if (deadlineDate < today) {
      return res.status(400).json({ error: 'Deadline must be today or in the future', code: 'PAST_DEADLINE' });
    }
    
    const task = await createTask(owner, repo, {
      title: title.trim(),
      description,
      priority,
      deadline,
      labels,
      linkedPR
    }, username);
    
    res.status(201).json({ task });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: error.message, code: 'CREATE_TASK_ERROR' });
  }
});

/**
 * PATCH /api/board/:owner/:repo/tasks/:id
 * Update task fields (owner only)
 */
router.patch('/:owner/:repo/tasks/:id', requireAuth, async (req, res) => {
  try {
    const { owner, repo, id } = req.params;
    const updates = req.body;
    const username = req.session.user.login;
    
    // Validate deadline if provided
    if (updates.deadline) {
      const deadlineDate = new Date(updates.deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      deadlineDate.setHours(0, 0, 0, 0);
      
      if (deadlineDate < today) {
        return res.status(400).json({ error: 'Deadline must be today or in the future', code: 'PAST_DEADLINE' });
      }
    }
    
    const task = await updateTask(owner, repo, id, updates, username);
    res.json({ task });
  } catch (error) {
    console.error('Error updating task:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message, code: 'TASK_NOT_FOUND' });
    }
    if (error.message.includes('Only the task creator')) {
      return res.status(403).json({ error: error.message, code: 'FORBIDDEN' });
    }
    res.status(500).json({ error: error.message, code: 'UPDATE_TASK_ERROR' });
  }
});

/**
 * DELETE /api/board/:owner/:repo/tasks/:id
 * Delete task (owner only)
 */
router.delete('/:owner/:repo/tasks/:id', requireAuth, async (req, res) => {
  try {
    const { owner, repo, id } = req.params;
    const username = req.session.user.login;
    
    await deleteTask(owner, repo, id, username);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message, code: 'TASK_NOT_FOUND' });
    }
    if (error.message.includes('Only the task creator')) {
      return res.status(403).json({ error: error.message, code: 'FORBIDDEN' });
    }
    res.status(500).json({ error: error.message, code: 'DELETE_TASK_ERROR' });
  }
});

/**
 * PATCH /api/board/:owner/:repo/tasks/:id/move
 * Move task to a different column (any authenticated user)
 */
router.patch('/:owner/:repo/tasks/:id/move', requireAuth, async (req, res) => {
  try {
    const { owner, repo, id } = req.params;
    const { column } = req.body;
    const username = req.session.user.login;
    
    if (!column) {
      return res.status(400).json({ error: 'Column is required', code: 'MISSING_COLUMN' });
    }
    
    const task = await moveTask(owner, repo, id, column, username);
    res.json({ task });
  } catch (error) {
    console.error('Error moving task:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message, code: 'TASK_NOT_FOUND' });
    }
    if (error.message.includes('Invalid column')) {
      return res.status(400).json({ error: error.message, code: 'INVALID_COLUMN' });
    }
    res.status(500).json({ error: error.message, code: 'MOVE_TASK_ERROR' });
  }
});

export default router;
