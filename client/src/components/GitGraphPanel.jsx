import { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import GitGraph from './GitGraph';
import CommitSummaryCard from './CommitSummaryCard';
import { startBackgroundAnalysis, getCommitsAnalysisStatus, subscribeToUpdates } from '../utils/api';

function GitGraphPanel({ repoData, onClose }) {
  const [selectedCommit, setSelectedCommit] = useState(null);
  const [analysisStatus, setAnalysisStatus] = useState({ total: 0, analyzed: 0, pending: 0, isProcessing: false });
  const [analysisProgress, setAnalysisProgress] = useState(null);

  const owner = repoData?.meta?.owner;
  const repo = repoData?.meta?.name;
  const commits = repoData?.commits || [];
  const branches = repoData?.branches || [];

  // Fetch analysis status on mount
  useEffect(() => {
    if (!owner || !repo) return;
    
    getCommitsAnalysisStatus(owner, repo)
      .then(setAnalysisStatus)
      .catch(err => console.warn('Could not fetch analysis status:', err));
  }, [owner, repo]);

  // Subscribe to SSE for real-time analysis updates
  useEffect(() => {
    if (!owner || !repo) return;

    const unsubscribe = subscribeToUpdates(owner, repo, (eventType, data) => {
      if (eventType === 'background_analysis_started') {
        setAnalysisProgress({ current: 0, total: data.total });
        setAnalysisStatus(prev => ({ ...prev, isProcessing: true }));
      }
      if (eventType === 'commit_analyzed') {
        setAnalysisProgress(data.progress);
        setAnalysisStatus(prev => ({
          ...prev,
          analyzed: prev.analyzed + 1,
          pending: prev.pending - 1,
        }));
      }
      if (eventType === 'background_analysis_completed') {
        setAnalysisProgress(null);
        setAnalysisStatus(prev => ({ ...prev, isProcessing: false }));
        // Refresh status
        getCommitsAnalysisStatus(owner, repo).then(setAnalysisStatus).catch(() => {});
      }
      if (eventType === 'background_analysis_error') {
        setAnalysisProgress(null);
        setAnalysisStatus(prev => ({ ...prev, isProcessing: false }));
      }
    });

    return unsubscribe;
  }, [owner, repo]);

  // Handle ESC key to close panel
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (selectedCommit) {
          setSelectedCommit(null);
        } else {
          onClose();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCommit, onClose]);

  const handleSelectCommit = useCallback((commit) => {
    setSelectedCommit(commit);
  }, []);

  const handleCloseCard = useCallback(() => {
    setSelectedCommit(null);
  }, []);

  const handleStartAnalysis = async () => {
    if (!owner || !repo) return;
    try {
      await startBackgroundAnalysis(owner, repo);
      setAnalysisStatus(prev => ({ ...prev, isProcessing: true }));
    } catch (err) {
      console.error('Failed to start analysis:', err);
    }
  };

  // Handle click outside to close
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const progressPercent = analysisStatus.total > 0 
    ? Math.round((analysisStatus.analyzed / analysisStatus.total) * 100)
    : 0;

  return (
    <div 
      className="modal-backdrop"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-6xl h-[85vh] mx-4 bg-white rounded-2xl shadow-elevated overflow-hidden flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200 bg-gradient-to-r from-surface-50 to-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-purple-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-surface-900">Git Graph</h2>
              <p className="text-sm text-surface-500">
                {owner}/{repo} · {commits.length} commits
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Analysis status & button */}
            <div className="flex items-center gap-3">
              {/* Progress indicator */}
              <div className="text-right">
                <div className="text-xs text-surface-500">
                  {analysisStatus.analyzed}/{analysisStatus.total} analyzed
                </div>
                <div className="w-24 h-1.5 bg-surface-200 rounded-full mt-1 overflow-hidden">
                  <div 
                    className="h-full bg-accent-500 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Analyze button */}
              {analysisStatus.pending > 0 && (
                <button
                  onClick={handleStartAnalysis}
                  disabled={analysisStatus.isProcessing}
                  className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-all duration-200 ${
                    analysisStatus.isProcessing
                      ? 'bg-surface-100 text-surface-400 cursor-not-allowed'
                      : 'bg-brand-500 text-white hover:bg-brand-600 shadow-sm'
                  }`}
                >
                  {analysisStatus.isProcessing ? (
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      {analysisProgress ? `${analysisProgress.current}/${analysisProgress.total}` : 'Analyzing...'}
                    </span>
                  ) : (
                    `Analyze ${analysisStatus.pending} commits`
                  )}
                </button>
              )}
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface-100 rounded-xl transition-all duration-200"
            >
              <svg className="w-6 h-6 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main content area with animated split */}
        <div className="flex-1 flex overflow-hidden">
          {/* Graph section - animates width */}
          <div 
            className={`transition-all duration-300 ease-in-out overflow-hidden ${
              selectedCommit ? 'w-[60%]' : 'w-full'
            }`}
          >
            <div className="h-full p-4">
              <GitGraph
                commits={commits}
                branches={branches}
                onSelectCommit={handleSelectCommit}
                selectedSha={selectedCommit?.sha}
                owner={owner}
                repo={repo}
              />
            </div>
          </div>

          {/* Summary card section - slides in from right */}
          <div 
            className={`transition-all duration-300 ease-in-out border-l border-surface-200 overflow-hidden ${
              selectedCommit ? 'w-[40%] opacity-100' : 'w-0 opacity-0'
            }`}
          >
            {selectedCommit && (
              <div className="h-full p-4">
                <CommitSummaryCard
                  commit={selectedCommit}
                  owner={owner}
                  repo={repo}
                  onClose={handleCloseCard}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 border-t border-surface-200 bg-surface-50">
          <p className="text-xs text-surface-500 text-center">
            Click on a commit node to view AI-powered analysis · 
            <span className="text-accent-600 font-medium"> Filled nodes</span> = analyzed · 
            <span className="text-surface-600"> Hollow nodes</span> = pending · 
            Press ESC to close
          </p>
        </div>
      </div>
    </div>
  );
}

GitGraphPanel.propTypes = {
  repoData: PropTypes.shape({
    meta: PropTypes.shape({
      owner: PropTypes.string,
      name: PropTypes.string,
    }),
    commits: PropTypes.array,
    branches: PropTypes.array,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
};

export default GitGraphPanel;
