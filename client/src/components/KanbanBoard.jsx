import { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import DeadlineWarningBanner from './DeadlineWarningBanner';
import ContributorFlagBadge from './ContributorFlagBadge';
import { getBoard, createTask, updateTask, deleteTask, moveTask } from '../utils/api';

const COLUMNS = [
  { id: 'todo', title: 'To Do', color: 'bg-slate-50', headerColor: 'bg-slate-100' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-blue-50', headerColor: 'bg-blue-100' },
  { id: 'in_review', title: 'In Review', color: 'bg-purple-50', headerColor: 'bg-purple-100' },
  { id: 'done', title: 'Done', color: 'bg-emerald-50', headerColor: 'bg-emerald-100' }
];

function Column({ column, tasks, currentUser, onTaskClick, onAddTask }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  const taskIds = tasks.map(t => t.id);

  return (
    <div 
      ref={setNodeRef}
      className={`flex flex-col rounded-xl ${column.color} ${isOver ? 'ring-2 ring-blue-400' : ''} transition-all min-h-[400px]`}
    >
      {/* Column header */}
      <div className={`px-4 py-3 ${column.headerColor} rounded-t-xl border-b border-slate-200`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-700">{column.title}</h3>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 bg-white/70 rounded-full text-sm font-medium text-slate-600">
              {tasks.length}
            </span>
            {column.id === 'todo' && (
              <button
                onClick={onAddTask}
                className="p-1 hover:bg-white/50 rounded transition-colors"
                title="Add task"
              >
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tasks */}
      <div className="p-3 space-y-3 flex-1 overflow-y-auto">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={onTaskClick}
              currentUser={currentUser}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="h-32 flex items-center justify-center text-slate-400 text-sm">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}

Column.propTypes = {
  column: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    color: PropTypes.string.isRequired,
    headerColor: PropTypes.string.isRequired
  }).isRequired,
  tasks: PropTypes.array.isRequired,
  currentUser: PropTypes.string.isRequired,
  onTaskClick: PropTypes.func.isRequired,
  onAddTask: PropTypes.func.isRequired
};

function KanbanBoard({ owner, repo, currentUser, onClose, embedded = false }) {
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [activeId, setActiveId] = useState(null);

  // Fetch board data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['board', owner, repo],
    queryFn: () => getBoard(owner, repo),
    refetchInterval: 30000,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (taskData) => createTask(owner, repo, taskData),
    onSuccess: () => queryClient.invalidateQueries(['board', owner, repo])
  });

  const updateMutation = useMutation({
    mutationFn: ({ taskId, updates }) => updateTask(owner, repo, taskId, updates),
    onSuccess: () => queryClient.invalidateQueries(['board', owner, repo])
  });

  const deleteMutation = useMutation({
    mutationFn: (taskId) => deleteTask(owner, repo, taskId),
    onSuccess: () => queryClient.invalidateQueries(['board', owner, repo])
  });

  const moveMutation = useMutation({
    mutationFn: ({ taskId, column }) => moveTask(owner, repo, taskId, column),
    onMutate: async ({ taskId, column }) => {
      await queryClient.cancelQueries(['board', owner, repo]);
      const previousData = queryClient.getQueryData(['board', owner, repo]);
      queryClient.setQueryData(['board', owner, repo], (old) => {
        if (!old) return old;
        return {
          ...old,
          board: {
            ...old.board,
            tasks: old.board.tasks.map(t =>
              t.id === taskId ? { ...t, column } : t
            )
          }
        };
      });
      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['board', owner, repo], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries(['board', owner, repo]);
    }
  });

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Group tasks by column
  const tasksByColumn = useMemo(() => {
    const tasks = data?.board?.tasks || [];
    const grouped = {};
    COLUMNS.forEach(col => {
      grouped[col.id] = tasks.filter(t => t.column === col.id);
    });
    return grouped;
  }, [data?.board?.tasks]);

  // Get unique assignees for flag badges
  const assignees = useMemo(() => {
    const tasks = data?.board?.tasks || [];
    return [...new Set(tasks.map(t => t.assignee))];
  }, [data?.board?.tasks]);

  // Find active task for drag overlay
  const activeTask = useMemo(() => {
    if (!activeId || !data?.board?.tasks) return null;
    return data.board.tasks.find(t => t.id === activeId);
  }, [activeId, data?.board?.tasks]);

  const handleDragStart = useCallback((event) => {
    setActiveId(event.active.id);
  }, []);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeTask = data?.board?.tasks.find(t => t.id === active.id);
    if (!activeTask) return;

    let targetColumn = over.id;
    const overTask = data?.board?.tasks.find(t => t.id === over.id);
    if (overTask) {
      targetColumn = overTask.column;
    }

    if (activeTask.column !== targetColumn && COLUMNS.some(c => c.id === targetColumn)) {
      moveMutation.mutate({ taskId: active.id, column: targetColumn });
    }
  }, [data?.board?.tasks, moveMutation]);

  const handleTaskClick = useCallback((task) => {
    setSelectedTask(task);
    setIsCreating(false);
    setIsModalOpen(true);
  }, []);

  const handleWarningTaskClick = useCallback((taskId) => {
    const task = data?.board?.tasks.find(t => t.id === taskId);
    if (task) {
      setSelectedTask(task);
      setIsCreating(false);
      setIsModalOpen(true);
    }
  }, [data?.board?.tasks]);

  const handleCreateClick = useCallback(() => {
    setSelectedTask(null);
    setIsCreating(true);
    setIsModalOpen(true);
  }, []);

  const handleSaveTask = async (taskData) => {
    if (isCreating) {
      await createMutation.mutateAsync(taskData);
    } else if (selectedTask) {
      await updateMutation.mutateAsync({ taskId: selectedTask.id, updates: taskData });
    }
  };

  const handleDeleteTask = async (taskId) => {
    await deleteMutation.mutateAsync(taskId);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedTask(null);
    setIsCreating(false);
  };

  // Embedded mode - render inline without modal wrapper
  if (embedded) {
    return (
      <div className="flex flex-col h-full min-h-[600px]">
        {/* Embedded Header */}
        <div 
          className="flex-shrink-0 px-6 py-4 text-white rounded-t-xl"
          style={{ background: 'linear-gradient(to right, #1e40af, #3b82f6)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <h2 className="text-xl font-bold">Task Board</h2>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {assignees.length > 0 && (
                <div className="hidden md:flex items-center space-x-2 mr-2">
                  {assignees.slice(0, 3).map(username => (
                    <ContributorFlagBadge
                      key={username}
                      owner={owner}
                      repo={repo}
                      username={username}
                    />
                  ))}
                </div>
              )}
              <button
                onClick={() => refetch()}
                className="p-2 rounded-lg transition-colors bg-white/20 hover:bg-white/30"
                title="Refresh board"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={handleCreateClick}
                className="flex items-center space-x-2 px-4 py-2 bg-white text-blue-700 rounded-lg font-medium transition-colors hover:bg-blue-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>New Task</span>
              </button>
            </div>
          </div>
        </div>

        {/* Embedded Content */}
        <div className="flex-1 overflow-auto p-6 bg-slate-50">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center space-y-3 text-slate-500">
                <svg className="animate-spin h-8 w-8" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Loading board...</span>
              </div>
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="font-medium text-red-600">Failed to load board</p>
                <p className="text-sm text-slate-500 mt-1">{error.message}</p>
                <button
                  onClick={() => refetch()}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : (
            <>
              <DeadlineWarningBanner
                warnings={data?.warnings}
                onTaskClick={handleWarningTaskClick}
              />
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {COLUMNS.map(column => (
                    <Column
                      key={column.id}
                      column={column}
                      tasks={tasksByColumn[column.id] || []}
                      currentUser={currentUser}
                      onTaskClick={handleTaskClick}
                      onAddTask={handleCreateClick}
                    />
                  ))}
                </div>
                <DragOverlay>
                  {activeTask ? (
                    <div className="opacity-90 rotate-3">
                      <TaskCard
                        task={activeTask}
                        onClick={() => {}}
                        currentUser={currentUser}
                      />
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </>
          )}
        </div>

        {/* Embedded Footer */}
        <div className="flex-shrink-0 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-sm text-slate-600 bg-slate-50 rounded-b-xl">
          <div className="flex items-center space-x-4">
            <span className="font-medium">{data?.board?.tasks?.length || 0} total tasks</span>
            <span className="text-slate-300">|</span>
            <span className="text-red-600">{data?.warnings?.filter(w => w.deadlineStatus === 'overdue').length || 0} overdue</span>
            <span className="text-slate-300">|</span>
            <span className="text-amber-600">{data?.warnings?.filter(w => w.deadlineStatus === 'approaching').length || 0} due soon</span>
          </div>
          <div className="text-slate-400 text-xs">
            {data?.board?.lastUpdated && `Last updated: ${new Date(data.board.lastUpdated).toLocaleString()}`}
          </div>
        </div>

        {/* Task Modal */}
        <TaskModal
          task={selectedTask}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          currentUser={currentUser}
          isCreating={isCreating}
        />
      </div>
    );
  }

  // Modal mode - original behavior
  return (
    <div 
      className="fixed inset-0 z-50 overflow-hidden"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)' }}
    >
      {/* Main Panel */}
      <div 
        className="absolute top-4 left-4 right-4 bottom-4 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div 
          className="flex-shrink-0 px-6 py-4 text-white"
          style={{ background: 'linear-gradient(to right, #1e40af, #3b82f6)' }}
        >
          <div className="flex items-center justify-between">
            {/* Left side - Title */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <h2 className="text-xl font-bold">Task Board</h2>
              </div>
              <span className="opacity-70 text-sm">{owner}/{repo}</span>
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center space-x-3">
              {/* Contributor flag badges */}
              {assignees.length > 0 && (
                <div className="hidden md:flex items-center space-x-2 mr-2">
                  {assignees.slice(0, 3).map(username => (
                    <ContributorFlagBadge
                      key={username}
                      owner={owner}
                      repo={repo}
                      username={username}
                    />
                  ))}
                </div>
              )}

              {/* Refresh button */}
              <button
                onClick={() => refetch()}
                className="p-2 rounded-lg transition-colors"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                title="Refresh board"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>

              {/* Create task button */}
              <button
                onClick={handleCreateClick}
                className="flex items-center space-x-2 px-4 py-2 bg-white text-blue-700 rounded-lg font-medium transition-colors hover:bg-blue-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>New Task</span>
              </button>

              {/* Header Close button */}
              <button
                onClick={onClose}
                className="p-2 rounded-lg transition-colors hover:bg-white/30"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                title="Close board"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-slate-50">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center space-y-3 text-slate-500">
                <svg className="animate-spin h-8 w-8" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Loading board...</span>
              </div>
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="font-medium text-red-600">Failed to load board</p>
                <p className="text-sm text-slate-500 mt-1">{error.message}</p>
                <button
                  onClick={() => refetch()}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Deadline warnings */}
              <DeadlineWarningBanner
                warnings={data?.warnings}
                onTaskClick={handleWarningTaskClick}
              />

              {/* Kanban columns */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {COLUMNS.map(column => (
                    <Column
                      key={column.id}
                      column={column}
                      tasks={tasksByColumn[column.id] || []}
                      currentUser={currentUser}
                      onTaskClick={handleTaskClick}
                      onAddTask={handleCreateClick}
                    />
                  ))}
                </div>

                {/* Drag overlay */}
                <DragOverlay>
                  {activeTask ? (
                    <div className="opacity-90 rotate-3">
                      <TaskCard
                        task={activeTask}
                        onClick={() => {}}
                        currentUser={currentUser}
                      />
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </>
          )}
        </div>

        {/* Footer stats */}
        <div 
          className="flex-shrink-0 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-sm text-slate-600 bg-slate-50"
        >
          <div className="flex items-center space-x-4">
            <span className="font-medium">{data?.board?.tasks?.length || 0} total tasks</span>
            <span className="text-slate-300">|</span>
            <span className="text-red-600">{data?.warnings?.filter(w => w.deadlineStatus === 'overdue').length || 0} overdue</span>
            <span className="text-slate-300">|</span>
            <span className="text-amber-600">{data?.warnings?.filter(w => w.deadlineStatus === 'approaching').length || 0} due soon</span>
          </div>
          <div className="text-slate-400 text-xs">
            {data?.board?.lastUpdated && `Last updated: ${new Date(data.board.lastUpdated).toLocaleString()}`}
          </div>
        </div>
      </div>

      {/* Task Modal */}
      <TaskModal
        task={selectedTask}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        currentUser={currentUser}
        isCreating={isCreating}
      />
    </div>
  );
}

KanbanBoard.propTypes = {
  owner: PropTypes.string.isRequired,
  repo: PropTypes.string.isRequired,
  currentUser: PropTypes.string.isRequired,
  onClose: PropTypes.func,
  embedded: PropTypes.bool
};

export default KanbanBoard;
