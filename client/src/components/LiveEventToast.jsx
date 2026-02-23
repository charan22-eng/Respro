import { useEffect } from 'react';
import PropTypes from 'prop-types';

function LiveEventToast({ events, onDismiss }) {
  // Auto-dismiss events after 10 seconds
  useEffect(() => {
    if (events.length === 0) return;
    
    const timers = events.map(event => {
      return setTimeout(() => {
        onDismiss(event.id);
      }, 10000);
    });

    return () => timers.forEach(t => clearTimeout(t));
  }, [events, onDismiss]);

  if (events.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      {events.slice(-5).map((event) => (
        <div
          key={event.id}
          className="premium-card p-4 animate-slide-in shadow-elevated"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <span className="flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-accent-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-500"></span>
              </span>
              <span className="text-xs font-medium text-accent-600 uppercase tracking-wide">
                Live Event
              </span>
            </div>
            <button
              onClick={() => onDismiss(event.id)}
              className="text-surface-400 hover:text-surface-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-2">
            {/* Event type badge */}
            <div className="flex items-center space-x-2 mb-1">
              <span className={`text-xs px-1.5 py-0.5 rounded-md ${
                event.eventType === 'commit' ? 'bg-blue-100 text-blue-700' :
                event.eventType === 'merge' ? 'bg-purple-100 text-purple-700' :
                event.eventType === 'pr_open' ? 'bg-accent-100 text-accent-700' :
                'bg-surface-100 text-surface-600'
              }`}>
                {event.eventType?.replace('_', ' ') || 'push'}
              </span>
              {event.branch && (
                <span className="text-xs text-surface-400">
                  on {event.branch}
                </span>
              )}
            </div>

            {/* Author and commit info */}
            <div className="flex items-center space-x-2 mb-1">
              <span className="text-sm font-medium text-surface-900">
                {event.author || 'Unknown'}
              </span>
              {event.shortId && (
                <code className="text-xs font-mono text-surface-400">
                  {event.shortId}
                </code>
              )}
            </div>

            {/* Commit message */}
            {event.message && (
              <p className="text-sm text-surface-600 line-clamp-2">
                {event.message}
              </p>
            )}

            {/* AI Summary (if processed) */}
            {event.added && (
              <div className="mt-2 pt-2 border-t border-surface-100">
                <div className="flex items-start space-x-1">
                  <span className="text-xs font-medium text-accent-600 flex-shrink-0">Added:</span>
                  <span className="text-xs text-surface-700">{event.added}</span>
                </div>
                {event.impact && (
                  <div className="flex items-start space-x-1 mt-0.5">
                    <span className="text-xs font-medium text-brand-600 flex-shrink-0">Impact:</span>
                    <span className="text-xs text-surface-600">{event.impact}</span>
                  </div>
                )}
              </div>
            )}

            {/* Processing indicator */}
            {!event.added && event.processing !== false && (
              <div className="mt-2 flex items-center space-x-2 text-xs text-surface-400">
                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Processing with AI...</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

LiveEventToast.propTypes = {
  events: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number.isRequired,
      eventType: PropTypes.string,
      author: PropTypes.string,
      message: PropTypes.string,
      shortId: PropTypes.string,
      branch: PropTypes.string,
      added: PropTypes.string,
      impact: PropTypes.string,
    })
  ).isRequired,
  onDismiss: PropTypes.func.isRequired,
};

export default LiveEventToast;
