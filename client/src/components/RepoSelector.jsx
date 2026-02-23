import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getAuthRepos, createWebhook } from '../utils/api';

/**
 * RepoSelector Component
 * Searchable dropdown of the authenticated user's repositories
 */
function RepoSelector({ onSubmit, isLoading, onSwitchToManual }) {
  const [repos, setRepos] = useState([]);
  const [search, setSearch] = useState('');
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchRepos() {
      try {
        const data = await getAuthRepos();
        setRepos(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingRepos(false);
      }
    }
    fetchRepos();
  }, []);

  const filtered = search
    ? repos.filter(r => r.fullName.toLowerCase().includes(search.toLowerCase()))
    : repos;

  const handleSelect = (repo) => {
    onSubmit(repo.fullName);
    // Auto-create webhook in background (non-blocking)
    createWebhook(repo.owner, repo.name).catch(err =>
      console.warn('Auto-webhook creation failed (non-critical):', err.message)
    );
  };

  const langColors = {
    JavaScript: 'bg-yellow-400',
    TypeScript: 'bg-blue-500',
    Python: 'bg-accent-500',
    Java: 'bg-red-500',
    Go: 'bg-cyan-500',
    Rust: 'bg-orange-500',
    C: 'bg-surface-500',
    'C++': 'bg-pink-500',
    Ruby: 'bg-red-600',
    PHP: 'bg-indigo-400',
  };

  return (
    <div className="w-full max-w-xl">
      {/* Search input */}
      <div className="relative mb-3">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" fill="none"
             stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your repositories..."
          className="input-primary pl-10"
          autoFocus
        />
      </div>

      {/* Repo list */}
      <div className="premium-card max-h-80 overflow-y-auto">
        {loadingRepos && (
          <div className="px-4 py-8 text-center text-surface-400 text-sm">
            Loading your repositories...
          </div>
        )}

        {error && (
          <div className="px-4 py-4 text-center text-red-600 text-sm">
            {error}
          </div>
        )}

        {!loadingRepos && !error && filtered.length === 0 && (
          <div className="px-4 py-6 text-center text-surface-400 text-sm">
            {search ? 'No repos match your search' : 'No repositories found'}
          </div>
        )}

        {!loadingRepos && !error && filtered.map((repo) => (
          <button
            key={repo.fullName}
            onClick={() => handleSelect(repo)}
            disabled={isLoading}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-surface-50
                       border-b border-surface-50 last:border-b-0 transition-all duration-200 disabled:opacity-50"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-surface-900 text-sm truncate">{repo.fullName}</span>
                {repo.private && (
                  <span className="chip bg-surface-100 text-surface-600">
                    Private
                  </span>
                )}
              </div>
              {repo.description && (
                <p className="text-xs text-surface-500 truncate mt-0.5">{repo.description}</p>
              )}
            </div>
            <div className="flex items-center space-x-3 ml-3 flex-shrink-0">
              {repo.language && (
                <div className="flex items-center space-x-1">
                  <span className={`w-2 h-2 rounded-full ${langColors[repo.language] || 'bg-surface-400'}`} />
                  <span className="text-xs text-surface-500">{repo.language}</span>
                </div>
              )}
              {repo.stars > 0 && (
                <span className="text-xs text-surface-400">{repo.stars}</span>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Manual fallback */}
      {onSwitchToManual && (
        <button
          onClick={onSwitchToManual}
          className="mt-3 text-sm text-surface-500 hover:text-brand-600 transition-colors"
        >
          or enter a repo URL manually
        </button>
      )}
    </div>
  );
}

RepoSelector.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  onSwitchToManual: PropTypes.func,
};

export default RepoSelector;
