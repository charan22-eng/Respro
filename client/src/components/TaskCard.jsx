import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import PropTypes from 'prop-types';

const priorityConfig = {
  critical: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300', dot: 'bg-red-500' },
  high: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300', dot: 'bg-orange-500' },
  medium: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', dot: 'bg-blue-500' },
  low: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', dot: 'bg-gray-400' }
};

const deadlineStatusConfig = {
  overdue: { bg: 'bg-red-50', border: 'border-red-400', icon: 'text-red-500' },
  approaching: { bg: 'bg-amber-50', border: 'border-amber-400', icon: 'text-amber-500' },
  on_track: { bg: 'bg-white', border: 'border-gray-200', icon: 'text-gray-400' }
};

function formatDeadline(deadline) {
  const date = new Date(deadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadlineDay = new Date(date);
  deadlineDay.setHours(0, 0, 0, 0);
  
  const diff = Math.floor((deadlineDay - today) / (1000 * 60 * 60 * 24));
  
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  if (diff <= 7) return `${diff}d left`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function TaskCard({ task, onClick, currentUser }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  const priority = priorityConfig[task.priority] || priorityConfig.medium;
  const deadlineStatus = deadlineStatusConfig[task.deadlineStatus] || deadlineStatusConfig.on_track;
  const isOwner = currentUser === task.createdBy;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(task)}
      className={`
        p-3 rounded-lg border-2 cursor-grab active:cursor-grabbing
        ${deadlineStatus.bg} ${deadlineStatus.border}
        ${task.flagged ? 'ring-2 ring-red-400 ring-offset-1' : ''}
        hover:shadow-md transition-all duration-150
        ${isDragging ? 'shadow-lg scale-105' : ''}
      `}
    >
      {/* Priority & Flag indicator */}
      <div className="flex items-center justify-between mb-2">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${priority.bg} ${priority.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${priority.dot} mr-1.5`}></span>
          {task.priority}
        </span>
        {task.flagged && (
          <span className="text-red-500" title="Overdue - flagged">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" />
            </svg>
          </span>
        )}
      </div>

      {/* Title */}
      <h4 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-2">
        {task.title}
      </h4>

      {/* Description preview */}
      {task.description && (
        <p className="text-xs text-gray-600 mb-2 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.labels.slice(0, 3).map((label, idx) => (
            <span key={idx} className="px-1.5 py-0.5 bg-pulse-100 text-pulse-700 text-xs rounded">
              {label}
            </span>
          ))}
          {task.labels.length > 3 && (
            <span className="text-xs text-gray-500">+{task.labels.length - 3}</span>
          )}
        </div>
      )}

      {/* Footer: Deadline, PR link, Assignee */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200">
        {/* Deadline */}
        <div className={`flex items-center text-xs ${deadlineStatus.icon}`}>
          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {formatDeadline(task.deadline)}
        </div>

        {/* Linked PR */}
        {task.linkedPR && (
          <span className="text-xs text-purple-600 font-medium" title={`Linked to PR #${task.linkedPR}`}>
            #{task.linkedPR}
          </span>
        )}

        {/* Assignee */}
        <div className="flex items-center" title={`Assigned to ${task.assignee}${isOwner ? ' (you)' : ''}`}>
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${isOwner ? 'bg-pulse-500 text-white' : 'bg-gray-300 text-gray-700'}`}>
            {task.assignee[0].toUpperCase()}
          </div>
        </div>
      </div>
    </div>
  );
}

TaskCard.propTypes = {
  task: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    description: PropTypes.string,
    column: PropTypes.string.isRequired,
    priority: PropTypes.oneOf(['critical', 'high', 'medium', 'low']).isRequired,
    deadline: PropTypes.string.isRequired,
    assignee: PropTypes.string.isRequired,
    createdBy: PropTypes.string.isRequired,
    labels: PropTypes.arrayOf(PropTypes.string),
    linkedPR: PropTypes.number,
    deadlineStatus: PropTypes.string,
    flagged: PropTypes.bool
  }).isRequired,
  onClick: PropTypes.func.isRequired,
  currentUser: PropTypes.string.isRequired
};

export default TaskCard;
