function PullRequestList({ pullRequests }) {
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="premium-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-surface-900">Open Pull Requests</h3>
        <span className="text-sm text-surface-500">{pullRequests.length} open</span>
      </div>
      
      {pullRequests.length === 0 ? (
        <div className="empty-state py-8">
          <div className="empty-state-icon">
            <svg
              className="w-8 h-8 text-surface-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-surface-500">No open pull requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pullRequests.slice(0, 5).map((pr) => (
            <div
              key={pr.number}
              className={`p-3 rounded-xl bg-surface-50 hover:bg-surface-100 transition-all duration-200 ${pr.isDraft ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <svg
                      className="w-4 h-4 text-accent-500 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                      />
                    </svg>
                    <span className="font-medium text-surface-900 truncate">
                      {pr.title}
                    </span>
                    {pr.isDraft && (
                      <span className="chip bg-surface-200 text-surface-600">
                        Draft
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-surface-500">
                    #{pr.number} opened {formatDate(pr.createdAt)} by {pr.author}
                  </div>
                  {pr.branch && (
                    <div className="mt-1 text-xs text-surface-400 font-mono">
                      {pr.branch} → {pr.baseBranch}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {pullRequests.length > 5 && (
        <p className="mt-3 text-sm text-surface-500 text-center">
          +{pullRequests.length - 5} more pull requests
        </p>
      )}
    </div>
  );
}

export default PullRequestList;
