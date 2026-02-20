import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getPlaybookCommit, analyzeCommit } from '../utils/api';

function CommitSummaryCard({ commit, owner, repo, onClose }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null); // 'playbook' or 'llm'

  useEffect(() => {
    if (!commit?.sha || !owner || !repo) return;

    setLoading(true);
    setError(null);
    setSource(null);

    // First, check if we have this commit in the playbook
    getPlaybookCommit(owner, repo, commit.sha)
      .then((result) => {
        if (result.found && result.commit?.added) {
          // Found in playbook with analysis
          setAnalysis({
            headline: result.commit.added,
            type: result.commit.eventType || 'commit',
            changeImpact: determineImpact(result.commit),
            before: result.commit.before,
            after: result.commit.added,
            keyInsight: result.commit.impact,
            filesAnalyzed: result.commit.filesChanged || [],
            keywords: result.commit.keywords || [],
            commitMeta: {
              author: result.commit.author,
              branch: result.commit.branch,
              timestamp: result.commit.timestamp
            }
          });
          setSource('playbook');
          setLoading(false);
        } else {
          // Not found in playbook, fall back to LLM analysis
          return analyzeCommit(owner, repo, commit.sha)
            .then((data) => {
              setAnalysis(data);
              setSource('llm');
            });
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to analyze commit');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [commit?.sha, owner, repo]);

  // Determine impact level from commit data
  function determineImpact(commitData) {
    const filesCount = commitData.filesChanged?.length || 0;
    if (filesCount > 10) return 'high';
    if (filesCount > 3) return 'medium';
    return 'low';
  }

  const typeColors = {
    feature: 'bg-green-100 text-green-700',
    bugfix: 'bg-red-100 text-red-700',
    refactor: 'bg-blue-100 text-blue-700',
    docs: 'bg-yellow-100 text-yellow-700',
    test: 'bg-purple-100 text-purple-700',
    chore: 'bg-gray-100 text-gray-600',
    style: 'bg-pink-100 text-pink-700',
    commit: 'bg-blue-100 text-blue-700',
    merge: 'bg-purple-100 text-purple-700',
  };

  const impactColors = {
    high: 'text-red-600',
    medium: 'text-yellow-600',
    low: 'text-green-600',
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-pulse-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-pulse-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Commit Analysis</h3>
            <div className="flex items-center space-x-2">
              <code className="text-xs text-gray-500 font-mono">{commit?.sha?.substring(0, 7)}</code>
              {source && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  source === 'playbook' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  {source === 'playbook' ? 'cached' : 'live'}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
        >
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading && (
          <div className="flex flex-col items-center justify-center h-full space-y-3">
            <svg className="animate-spin h-8 w-8 text-pulse-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm text-gray-500">Checking playbook...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            <div className="font-medium mb-1">Analysis failed</div>
            <div className="text-red-600">{error}</div>
          </div>
        )}

        {!loading && !error && analysis && (
          <div className="space-y-4">
            {/* Headline */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 leading-snug">
                {analysis.headline || commit?.message}
              </h4>
              <div className="flex items-center space-x-2 mt-2">
                {analysis.type && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[analysis.type] || typeColors.commit}`}>
                    {analysis.type}
                  </span>
                )}
                {analysis.changeImpact && (
                  <span className={`text-xs font-medium ${impactColors[analysis.changeImpact] || 'text-gray-600'}`}>
                    {analysis.changeImpact} impact
                  </span>
                )}
              </div>
            </div>

            {/* Before/After from playbook */}
            {(analysis.before || analysis.after) && (
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Change Summary
                </div>
                {analysis.before && (
                  <div className="flex items-start space-x-2">
                    <span className="text-xs text-gray-500 font-medium w-14 flex-shrink-0">Before:</span>
                    <span className="text-sm text-gray-600">{analysis.before}</span>
                  </div>
                )}
                {analysis.after && (
                  <div className="flex items-start space-x-2">
                    <span className="text-xs text-green-600 font-medium w-14 flex-shrink-0">Added:</span>
                    <span className="text-sm text-gray-800 font-medium">{analysis.after}</span>
                  </div>
                )}
              </div>
            )}

            {/* File Changes (from LLM analysis) */}
            {analysis.fileChanges && analysis.fileChanges.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  File Changes
                </div>
                {analysis.fileChanges.slice(0, 5).map((change, idx) => (
                  <div key={idx} className="text-sm">
                    <div className="font-mono text-xs text-gray-600 mb-1">
                      {change.file}
                    </div>
                    {change.before && (
                      <div className="flex items-start space-x-2">
                        <span className="text-xs text-red-500 font-medium w-12 flex-shrink-0">Before:</span>
                        <span className="text-gray-600 text-xs">{change.before}</span>
                      </div>
                    )}
                    {change.after && (
                      <div className="flex items-start space-x-2">
                        <span className="text-xs text-green-500 font-medium w-12 flex-shrink-0">After:</span>
                        <span className="text-gray-700 text-xs">{change.after}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Key Insight / Impact */}
            {analysis.keyInsight && (
              <div className="bg-pulse-50 border border-pulse-200 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <svg className="w-4 h-4 text-pulse-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <div>
                    <div className="text-xs font-medium text-pulse-700 uppercase tracking-wide mb-1">
                      Impact
                    </div>
                    <p className="text-sm text-gray-700">{analysis.keyInsight}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Keywords */}
            {analysis.keywords && analysis.keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {analysis.keywords.map((kw, idx) => (
                  <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {kw}
                  </span>
                ))}
              </div>
            )}

            {/* Files Analyzed */}
            {analysis.filesAnalyzed && analysis.filesAnalyzed.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Files ({analysis.filesAnalyzed.length})
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {analysis.filesAnalyzed.slice(0, 10).map((file, idx) => (
                    <div key={idx} className="flex items-center space-x-2 text-xs">
                      <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="font-mono text-gray-600 truncate">{file}</span>
                    </div>
                  ))}
                  {analysis.filesAnalyzed.length > 10 && (
                    <div className="text-xs text-gray-400 pl-5">
                      +{analysis.filesAnalyzed.length - 10} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Commit Meta */}
            {analysis.commitMeta && (
              <div className="pt-3 border-t border-gray-200 text-xs text-gray-500">
                <div className="flex items-center space-x-3">
                  {analysis.commitMeta.author && <span>{analysis.commitMeta.author}</span>}
                  {analysis.commitMeta.branch && <span>on {analysis.commitMeta.branch}</span>}
                  {analysis.commitMeta.additions !== undefined && (
                    <>
                      <span className="text-green-600">+{analysis.commitMeta.additions}</span>
                      <span className="text-red-600">-{analysis.commitMeta.deletions || 0}</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

CommitSummaryCard.propTypes = {
  commit: PropTypes.shape({
    sha: PropTypes.string.isRequired,
    message: PropTypes.string,
    author: PropTypes.string,
    date: PropTypes.string,
  }),
  owner: PropTypes.string.isRequired,
  repo: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default CommitSummaryCard;
