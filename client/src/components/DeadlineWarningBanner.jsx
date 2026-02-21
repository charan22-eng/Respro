import PropTypes from 'prop-types';

function DeadlineWarningBanner({ warnings, onTaskClick }) {
  if (!warnings || warnings.length === 0) return null;

  const overdueWarnings = warnings.filter(w => w.deadlineStatus === 'overdue');
  const approachingWarnings = warnings.filter(w => w.deadlineStatus === 'approaching');

  return (
    <div className="mb-4 space-y-2">
      {/* Overdue warning banner */}
      {overdueWarnings.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-semibold text-red-800">
                {overdueWarnings.length} Overdue Task{overdueWarnings.length > 1 ? 's' : ''}
              </h3>
              <div className="mt-2 space-y-1">
                {overdueWarnings.slice(0, 3).map(warning => (
                  <button
                    key={warning.taskId}
                    onClick={() => onTaskClick(warning.taskId)}
                    className="block w-full text-left text-sm text-red-700 hover:text-red-900 hover:underline"
                  >
                    <span className="font-medium">{warning.title}</span>
                    <span className="text-red-500 ml-2">
                      ({Math.abs(warning.daysRemaining)}d overdue - @{warning.assignee})
                    </span>
                  </button>
                ))}
                {overdueWarnings.length > 3 && (
                  <p className="text-xs text-red-600">
                    +{overdueWarnings.length - 3} more overdue tasks
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approaching deadline warning banner */}
      {approachingWarnings.length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-semibold text-amber-800">
                {approachingWarnings.length} Task{approachingWarnings.length > 1 ? 's' : ''} Due Soon
              </h3>
              <div className="mt-2 space-y-1">
                {approachingWarnings.slice(0, 3).map(warning => (
                  <button
                    key={warning.taskId}
                    onClick={() => onTaskClick(warning.taskId)}
                    className="block w-full text-left text-sm text-amber-700 hover:text-amber-900 hover:underline"
                  >
                    <span className="font-medium">{warning.title}</span>
                    <span className="text-amber-600 ml-2">
                      ({warning.daysRemaining === 0 ? 'Due today' : `${warning.daysRemaining}d left`} - @{warning.assignee})
                    </span>
                  </button>
                ))}
                {approachingWarnings.length > 3 && (
                  <p className="text-xs text-amber-600">
                    +{approachingWarnings.length - 3} more approaching
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

DeadlineWarningBanner.propTypes = {
  warnings: PropTypes.arrayOf(PropTypes.shape({
    taskId: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    assignee: PropTypes.string.isRequired,
    deadline: PropTypes.string.isRequired,
    deadlineStatus: PropTypes.string.isRequired,
    daysRemaining: PropTypes.number.isRequired
  })),
  onTaskClick: PropTypes.func.isRequired
};

export default DeadlineWarningBanner;
