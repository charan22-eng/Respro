function ActivityHeatmap({ commits, contributors }) {
  // Generate last 7 days
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    days.push(date.toISOString().split('T')[0]);
  }

  // Aggregate commits by day
  const commitsByDay = {};
  days.forEach(day => {
    commitsByDay[day] = 0;
  });

  commits.forEach(commit => {
    const day = new Date(commit.date).toISOString().split('T')[0];
    if (commitsByDay[day] !== undefined) {
      commitsByDay[day]++;
    }
  });

  const maxCommits = Math.max(...Object.values(commitsByDay), 1);

  const getIntensityClass = (count) => {
    if (count === 0) return 'bg-surface-100';
    const intensity = count / maxCommits;
    if (intensity > 0.75) return 'bg-brand-600';
    if (intensity > 0.5) return 'bg-brand-400';
    if (intensity > 0.25) return 'bg-brand-300';
    return 'bg-brand-200';
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="premium-card p-6">
      <h3 className="text-lg font-semibold text-surface-900 mb-4">
        Activity (Last 7 Days)
      </h3>
      <div className="flex items-end justify-between space-x-2 h-32">
        {days.map((day) => (
          <div key={day} className="flex-1 flex flex-col items-center">
            <div
              className={`w-full rounded-t-lg transition-all duration-300 ${getIntensityClass(commitsByDay[day])}`}
              style={{
                height: `${Math.max((commitsByDay[day] / maxCommits) * 100, 8)}%`,
                minHeight: commitsByDay[day] > 0 ? '20px' : '8px'
              }}
              title={`${commitsByDay[day]} commits on ${formatDate(day)}`}
            />
            <div className="mt-2 text-xs text-surface-500 text-center">
              {new Date(day).toLocaleDateString('en-US', { weekday: 'short' })}
            </div>
            <div className="text-xs font-medium text-surface-700">
              {commitsByDay[day]}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-surface-600">
        <span>Total: {commits.length} commits</span>
        <div className="flex items-center space-x-2">
          <span className="text-xs">Less</span>
          <div className="flex space-x-1">
            <div className="w-3 h-3 bg-surface-100 rounded" />
            <div className="w-3 h-3 bg-brand-200 rounded" />
            <div className="w-3 h-3 bg-brand-300 rounded" />
            <div className="w-3 h-3 bg-brand-400 rounded" />
            <div className="w-3 h-3 bg-brand-600 rounded" />
          </div>
          <span className="text-xs">More</span>
        </div>
      </div>
    </div>
  );
}

export default ActivityHeatmap;
