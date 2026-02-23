import PropTypes from 'prop-types';

function StatsGrid({ commits, branches, pullRequests, issues, contributors }) {
  const staleBranches = branches?.filter(b => b.isStale).length || 0;
  const activeContributors = contributors?.filter(c => 
    Object.keys(c.commitsByDay || {}).length > 0
  ).length || 0;

  const stats = [
    {
      label: 'Commits (7d)',
      value: commits?.length || 0,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      iconBg: 'bg-brand-100',
      iconColor: 'text-brand-600'
    },
    {
      label: 'Open PRs',
      value: pullRequests?.length || 0,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600'
    },
    {
      label: 'Open Issues',
      value: issues?.length || 0,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600'
    },
    {
      label: 'Branches',
      value: branches?.length || 0,
      subValue: staleBranches > 0 ? `${staleBranches} stale` : null,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      iconBg: staleBranches > 0 ? 'bg-red-100' : 'bg-purple-100',
      iconColor: staleBranches > 0 ? 'text-red-600' : 'text-purple-600'
    },
    {
      label: 'Contributors',
      value: activeContributors,
      subValue: `${contributors?.length || 0} total`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      iconBg: 'bg-accent-100',
      iconColor: 'text-accent-600'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="premium-card p-5 hover:shadow-elevated transition-shadow"
        >
          <div className="flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl ${stat.iconBg} flex items-center justify-center flex-shrink-0`}>
              <span className={stat.iconColor}>{stat.icon}</span>
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-bold text-surface-900">{stat.value}</div>
              <div className="text-sm text-surface-500 truncate">{stat.label}</div>
              {stat.subValue && (
                <div className="text-xs text-surface-400 mt-0.5">{stat.subValue}</div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

StatsGrid.propTypes = {
  commits: PropTypes.array,
  branches: PropTypes.array,
  pullRequests: PropTypes.array,
  issues: PropTypes.array,
  contributors: PropTypes.array
};

export default StatsGrid;
