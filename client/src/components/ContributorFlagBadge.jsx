import { useState } from 'react';
import PropTypes from 'prop-types';
import { useQuery } from '@tanstack/react-query';
import { getContributorFlags } from '../utils/api';

function ContributorFlagBadge({ owner, repo, username }) {
  const [showTooltip, setShowTooltip] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['contributorFlags', owner, repo, username],
    queryFn: () => getContributorFlags(owner, repo, username),
    staleTime: 60000, // 1 minute
    enabled: !!owner && !!repo && !!username
  });

  const flagCount = data?.flags?.length || 0;

  if (isLoading || flagCount === 0) return null;

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Badge */}
      <span className="status-badge error">
        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" />
        </svg>
        {flagCount} flag{flagCount > 1 ? 's' : ''}
      </span>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-surface-900 text-white text-xs rounded-xl shadow-elevated">
          <div className="font-semibold mb-2">Overdue Task History</div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {data.flags.slice(0, 5).map((flag, idx) => (
              <div key={idx} className="border-l-2 border-red-400 pl-2">
                <div className="font-medium truncate">{flag.taskTitle}</div>
                <div className="text-surface-400">
                  {flag.daysOverdue}d overdue on {new Date(flag.flaggedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
            {data.flags.length > 5 && (
              <div className="text-surface-400 italic">
                +{data.flags.length - 5} more flags
              </div>
            )}
          </div>
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="w-2 h-2 bg-surface-900 rotate-45"></div>
          </div>
        </div>
      )}
    </div>
  );
}

ContributorFlagBadge.propTypes = {
  owner: PropTypes.string.isRequired,
  repo: PropTypes.string.isRequired,
  username: PropTypes.string.isRequired
};

export default ContributorFlagBadge;
