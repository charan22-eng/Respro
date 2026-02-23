import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import PlaybookPanel from '../components/PlaybookPanel';
import GitGraphPanel from '../components/GitGraphPanel';
import CommitAnalyzer from '../components/CommitAnalyzer';
import ActivityHeatmap from '../components/ActivityHeatmap';
import CommitList from '../components/CommitList';

/**
 * Activity Page - Timeline, Git Graph, Playbook, and Commit Analysis
 */
function ActivityPage({ repoData, playbookRefreshKey, onAnalyzeCommit, initialAnalyzerSha }) {
  const [activeTab, setActiveTab] = useState('playbook');
  const [showGitGraph, setShowGitGraph] = useState(false);
  const [analyzerSha, setAnalyzerSha] = useState('');
  const commitAnalyzerRef = useRef(null);

  const { meta, commits, contributors } = repoData;

  // When initialAnalyzerSha changes (from external navigation), switch to analyzer tab
  useEffect(() => {
    if (initialAnalyzerSha) {
      setAnalyzerSha(initialAnalyzerSha);
      setActiveTab('analyzer');
      setTimeout(() => {
        commitAnalyzerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [initialAnalyzerSha]);

  const handleAnalyzeCommit = (sha) => {
    setAnalyzerSha(sha);
    setActiveTab('analyzer');
    setTimeout(() => {
      commitAnalyzerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    if (onAnalyzeCommit) onAnalyzeCommit(sha);
  };

  const tabs = [
    { id: 'playbook', label: 'Playbook', description: 'AI-generated commit summaries' },
    { id: 'commits', label: 'Commits', description: 'Recent commit history' },
    { id: 'heatmap', label: 'Heatmap', description: 'Activity visualization' },
    { id: 'analyzer', label: 'Analyzer', description: 'Deep commit analysis' },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#0f172a' }}>Activity</h1>
          <p className="mt-1" style={{ color: '#64748b' }}>Timeline, commits, and project history</p>
        </div>
        <button
          onClick={() => setShowGitGraph(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white transition-all hover:shadow-lg"
          style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="6" cy="6" r="2" strokeWidth={2} />
            <circle cx="18" cy="6" r="2" strokeWidth={2} />
            <circle cx="6" cy="18" r="2" strokeWidth={2} />
            <circle cx="18" cy="18" r="2" strokeWidth={2} />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 8v2c0 2 2 4 6 4s6-2 6-4V8" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 16v-2" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 16v-2" />
          </svg>
          Open Git Graph
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-6" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative py-4 px-1 text-sm font-medium transition-colors"
              style={{ 
                color: activeTab === tab.id ? '#2563eb' : '#64748b'
              }}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div 
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                  style={{ background: '#2563eb' }}
                />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px]">
        {/* Playbook Tab */}
        {activeTab === 'playbook' && (
          <div className="animate-fade-in">
            <PlaybookPanel 
              owner={meta.owner} 
              repo={meta.name} 
              refreshKey={playbookRefreshKey}
            />
          </div>
        )}

        {/* Commits Tab */}
        {activeTab === 'commits' && (
          <div className="animate-fade-in">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold" style={{ color: '#0f172a' }}>Recent Commits</h3>
                <span className="text-sm" style={{ color: '#64748b' }}>{commits?.length || 0} commits</span>
              </div>
              <CommitList 
                commits={commits} 
                owner={meta.owner} 
                repo={meta.name} 
                onAnalyze={handleAnalyzeCommit}
              />
            </div>
          </div>
        )}

        {/* Heatmap Tab */}
        {activeTab === 'heatmap' && (
          <div className="animate-fade-in space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4" style={{ color: '#0f172a' }}>Activity Overview</h3>
              <ActivityHeatmap commits={commits} contributors={contributors} />
            </div>
            
            {/* Activity Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: '#dbeafe' }}
                  >
                    <svg className="w-6 h-6" style={{ color: '#2563eb' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-2xl font-bold" style={{ color: '#0f172a' }}>{commits?.length || 0}</p>
                    <p className="text-sm" style={{ color: '#64748b' }}>Total Commits</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: '#d1fae5' }}
                  >
                    <svg className="w-6 h-6" style={{ color: '#059669' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-2xl font-bold" style={{ color: '#0f172a' }}>{contributors?.length || 0}</p>
                    <p className="text-sm" style={{ color: '#64748b' }}>Contributors</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: '#ede9fe' }}
                  >
                    <svg className="w-6 h-6" style={{ color: '#7c3aed' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-2xl font-bold" style={{ color: '#0f172a' }}>7</p>
                    <p className="text-sm" style={{ color: '#64748b' }}>Days Tracked</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Analyzer Tab */}
        {activeTab === 'analyzer' && (
          <div className="animate-fade-in" ref={commitAnalyzerRef}>
            <CommitAnalyzer
              owner={meta.owner}
              repo={meta.name}
              initialSha={analyzerSha}
            />
          </div>
        )}
      </div>

      {/* Git Graph Modal */}
      {showGitGraph && (
        <GitGraphPanel
          repoData={repoData}
          onClose={() => setShowGitGraph(false)}
        />
      )}
    </div>
  );
}

ActivityPage.propTypes = {
  repoData: PropTypes.shape({
    meta: PropTypes.shape({
      owner: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    }).isRequired,
    commits: PropTypes.array,
    contributors: PropTypes.array,
  }).isRequired,
  playbookRefreshKey: PropTypes.number,
  onAnalyzeCommit: PropTypes.func,
  initialAnalyzerSha: PropTypes.string,
};

export default ActivityPage;
