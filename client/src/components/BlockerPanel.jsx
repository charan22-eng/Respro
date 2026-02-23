import { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * BlockerPanel Component
 * Displays detected blockers as an alert-style panel on the dashboard
 */
function BlockerPanel({ blockers }) {
  const [expanded, setExpanded] = useState(false);

  if (!blockers || blockers.length === 0) return null;

  const severityColors = {
    high: { 
      bg: 'bg-red-50', 
      border: 'border-red-200', 
      badge: 'bg-red-100 text-red-700',
      text: 'text-red-700'
    },
    medium: { 
      bg: 'bg-amber-50', 
      border: 'border-amber-200', 
      badge: 'bg-amber-100 text-amber-700',
      text: 'text-amber-700'
    },
    low: { 
      bg: 'bg-surface-50', 
      border: 'border-surface-200', 
      badge: 'bg-surface-100 text-surface-600',
      text: 'text-surface-600'
    }
  };

  const highCount = blockers.filter(b => b.severity === 'high').length;
  const displayBlockers = expanded ? blockers : blockers.slice(0, 3);
  const hasMore = blockers.length > 3;

  return (
    <div className="premium-card overflow-hidden border-l-4 border-l-red-500">
      {/* Header */}
      <div className="px-6 py-4 bg-red-50 border-b border-red-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-red-900">
              Potential Blockers
            </h3>
            <span className="text-sm text-red-600">
              {blockers.length} detected
            </span>
          </div>
        </div>
        {highCount > 0 && (
          <span className="px-3 py-1 text-sm text-red-700 font-medium bg-red-100 rounded-full">
            {highCount} high severity
          </span>
        )}
      </div>

      {/* Blocker cards */}
      <div className="p-6 space-y-3">
        {displayBlockers.map((blocker, index) => {
          const colors = severityColors[blocker.severity] || severityColors.medium;
          return (
            <div key={index} className={`p-4 rounded-xl ${colors.bg} border ${colors.border}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${colors.badge}`}>
                      {blocker.severity.toUpperCase()}
                    </span>
                    <span className="text-xs text-surface-500 uppercase tracking-wide font-medium">
                      {blocker.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="font-medium text-surface-900 text-sm mb-1">{blocker.title}</p>
                  <p className="text-sm text-surface-600">{blocker.description}</p>
                  <div className="mt-3 flex items-start gap-2">
                    <svg className="w-4 h-4 text-brand-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <p className="text-sm text-brand-700 font-medium">
                      {blocker.suggestedAction}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-center text-sm text-red-700 hover:text-red-900 font-medium py-3 rounded-xl hover:bg-red-50 transition-colors"
          >
            {expanded ? 'Show less' : `Show ${blockers.length - 3} more blockers`}
          </button>
        )}
      </div>
    </div>
  );
}

BlockerPanel.propTypes = {
  blockers: PropTypes.arrayOf(PropTypes.shape({
    type: PropTypes.string.isRequired,
    severity: PropTypes.oneOf(['high', 'medium', 'low']).isRequired,
    title: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    suggestedAction: PropTypes.string.isRequired
  }))
};

export default BlockerPanel;
