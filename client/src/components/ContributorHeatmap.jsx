import PropTypes from 'prop-types';

/**
 * Get color class for a commit count
 */
function getCommitColor(count) {
  if (count === 0) return 'bg-red-100 border border-red-200';
  if (count <= 2) return 'bg-yellow-300 border border-yellow-400';
  return 'bg-accent-500 border border-accent-600';
}

/**
 * Format a date string to display format
 */
function formatDateForTooltip(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });
}

/**
 * Get abbreviated day name from date string
 */
function getDayAbbrev(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

/**
 * ContributorHeatmap Component
 * Displays a color-coded grid showing each contributor's daily commit activity
 */
function ContributorHeatmap({ contributors }) {
  // Handle empty/undefined state
  if (!contributors || contributors.length === 0) {
    return (
      <div className="premium-card p-6 mb-6">
        <h3 className="text-lg font-semibold text-surface-900 mb-4">
          Contributor Activity — Last 7 Days
        </h3>
        <div className="flex items-center justify-center py-8 text-surface-500">
          No contributor activity found for this repository.
        </div>
      </div>
    );
  }

  // Get sorted dates from the first contributor's commitsByDay
  const firstContributor = contributors[0];
  const dates = firstContributor?.commitsByDay 
    ? Object.keys(firstContributor.commitsByDay).sort()
    : [];

  // If no dates available, show empty state
  if (dates.length === 0) {
    return (
      <div className="premium-card p-6 mb-6">
        <h3 className="text-lg font-semibold text-surface-900 mb-4">
          Contributor Activity — Last 7 Days
        </h3>
        <div className="flex items-center justify-center py-8 text-surface-500">
          No contributor activity found for this repository.
        </div>
      </div>
    );
  }

  // Sort contributors by weekly activity (desc), then by total commits (desc)
  const sortedContributors = [...contributors]
    .map(contributor => {
      const weeklyCommits = Object.values(contributor.commitsByDay || {})
        .reduce((sum, count) => sum + count, 0);
      return { ...contributor, weeklyCommits };
    })
    .sort((a, b) => {
      if (b.weeklyCommits !== a.weeklyCommits) {
        return b.weeklyCommits - a.weeklyCommits;
      }
      return b.totalCommits - a.totalCommits;
    })
    .slice(0, 15); // Top 15 contributors

  return (
    <div className="premium-card p-6 mb-6">
      <h3 className="text-lg font-semibold text-surface-900 mb-4">
        Contributor Activity — Last 7 Days
      </h3>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-fit">
          {/* Day Labels Row */}
          <div className="flex items-center mb-2">
            {/* Spacer for avatar + username column */}
            <div className="w-40 flex-shrink-0" />
            {/* Day labels */}
            <div className="flex gap-1">
              {dates.map(date => (
                <div 
                  key={date} 
                  className="w-7 h-5 flex items-center justify-center text-xs text-surface-500 font-medium"
                >
                  {getDayAbbrev(date)}
                </div>
              ))}
            </div>
            {/* Spacer for total column */}
            <div className="w-16 flex-shrink-0" />
          </div>

          {/* Contributor Rows */}
          <div className="space-y-1">
            {sortedContributors.map(contributor => (
              <div 
                key={contributor.login} 
                className="flex items-center py-1 hover:bg-surface-50 rounded-xl transition-colors"
              >
                {/* Avatar + Username */}
                <div className="w-40 flex-shrink-0 flex items-center space-x-2 pr-3">
                  {contributor.avatarUrl ? (
                    <img
                      src={contributor.avatarUrl}
                      alt={contributor.login}
                      className="w-8 h-8 rounded-full flex-shrink-0 ring-2 ring-surface-100"
                    />
                  ) : (
                    <div className="avatar flex-shrink-0">
                      <span>
                        {contributor.login[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="text-sm font-medium text-surface-900 truncate">
                    {contributor.login}
                  </span>
                </div>

                {/* Activity Squares */}
                <div className="flex gap-1">
                  {dates.map(date => {
                    const count = contributor.commitsByDay?.[date] || 0;
                    return (
                      <div key={date} className="relative group">
                        <div
                          className={`w-7 h-7 rounded-lg ${getCommitColor(count)} cursor-default transition-transform group-hover:scale-110`}
                        />
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-surface-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                          {contributor.login} — {formatDateForTooltip(date)}: {count} commit{count !== 1 ? 's' : ''}
                          {/* Tooltip arrow */}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-surface-900" />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Weekly Total */}
                <div className="w-16 flex-shrink-0 text-right pl-3">
                  <span className="text-sm text-surface-500">
                    {contributor.weeklyCommits}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-surface-100 flex items-center justify-between">
        <span className="text-xs text-surface-500">
          Showing top {sortedContributors.length} of {contributors.length} contributors
        </span>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded bg-red-100 border border-red-200" />
            <span className="text-xs text-surface-500">0</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded bg-yellow-300 border border-yellow-400" />
            <span className="text-xs text-surface-500">1-2</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 rounded bg-accent-500 border border-accent-600" />
            <span className="text-xs text-surface-500">3+</span>
          </div>
        </div>
      </div>
    </div>
  );
}

ContributorHeatmap.propTypes = {
  contributors: PropTypes.arrayOf(
    PropTypes.shape({
      login: PropTypes.string.isRequired,
      avatarUrl: PropTypes.string,
      totalCommits: PropTypes.number,
      commitsByDay: PropTypes.object
    })
  )
};

export default ContributorHeatmap;
