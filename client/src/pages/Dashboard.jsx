import { useState, useRef, useCallback, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import RepoInput from '../components/RepoInput';
import RepoSelector from '../components/RepoSelector';
import AuthButton from '../components/AuthButton';
import LoadingState from '../components/LoadingState';
import ErrorDisplay from '../components/ErrorDisplay';
import DashboardContent from '../components/DashboardContent';
import PulseSummary from '../components/PulseSummary';
import ContributorHeatmap from '../components/ContributorHeatmap';
import BlockerPanel from '../components/BlockerPanel';
import ChatPanel from '../components/ChatPanel';
import CommitAnalyzer from '../components/CommitAnalyzer';
import PlaybookPanel from '../components/PlaybookPanel';
import LiveEventToast from '../components/LiveEventToast';
import GitGraphPanel from '../components/GitGraphPanel';
import CollisionRadarPanel from '../components/CollisionRadarPanel';
import HealthCheckupPanel from '../components/HealthCheckupPanel';
import KanbanBoard from '../components/KanbanBoard';
import { fetchPulseData, getAuthUser, subscribeToUpdates } from '../utils/api';

function Dashboard() {
  const [pulseData, setPulseData] = useState(null);
  const [analyzerSha, setAnalyzerSha] = useState('');
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [useManualInput, setUseManualInput] = useState(false);
  const [aiPending, setAiPending] = useState(false);
  const [liveEvents, setLiveEvents] = useState([]);
  const [playbookRefreshKey, setPlaybookRefreshKey] = useState(0);
const [showGitGraph, setShowGitGraph] = useState(false);
  const [showCollisionRadar, setShowCollisionRadar] = useState(false);
  const [showHealthCheckup, setShowHealthCheckup] = useState(false);
  const [showKanbanBoard, setShowKanbanBoard] = useState(false);
  const commitAnalyzerRef = useRef(null);
  const sseCleanupRef = useRef(null);

  // Setup SSE subscription when we have repo data
  useEffect(() => {
    const repoData = pulseData?.repoData;
    if (!repoData?.meta) return;

    const { owner, name } = repoData.meta;
    
    // Cleanup previous subscription
    if (sseCleanupRef.current) sseCleanupRef.current();
    
    sseCleanupRef.current = subscribeToUpdates(owner, name, (eventType, eventData) => {
      switch (eventType) {
        case 'summary':
          setPulseData(prev => ({
            ...prev,
            summary: eventData.summary,
            summaryError: eventData.summaryError,
            playbookAvailable: eventData.playbookAvailable
          }));
          setAiPending(false);
          break;
          
        case 'new_event':
          // Show toast for incoming event
          setLiveEvents(prev => [...prev, { ...eventData, id: Date.now() }]);
          break;
          
        case 'event_processed':
          // Update toast with processed data and add to commits
          setLiveEvents(prev => 
            prev.map(e => e.commitId === eventData.commitId ? { ...eventData, id: e.id } : e)
          );
          // Add new commit to repoData
          setPulseData(prev => {
            if (!prev?.repoData?.commits) return prev;
            const newCommit = {
              sha: eventData.commitId,
              author: eventData.author,
              message: eventData.message,
              date: eventData.timestamp,
              branch: eventData.branch
            };
            // Check if commit already exists
            if (prev.repoData.commits.some(c => c.sha === newCommit.sha)) return prev;
            return {
              ...prev,
              repoData: {
                ...prev.repoData,
                commits: [newCommit, ...prev.repoData.commits]
              }
            };
          });
          break;
          
        case 'playbook_updated':
          // Trigger playbook panel refresh
          setPlaybookRefreshKey(k => k + 1);
          break;
          
        case 'playbook':
          setPulseData(prev => ({
            ...prev,
            playbookAvailable: eventData.available
          }));
          setPlaybookRefreshKey(k => k + 1);
          break;
      }
    });

    return () => {
      if (sseCleanupRef.current) sseCleanupRef.current();
    };
  }, [pulseData?.repoData?.meta?.owner, pulseData?.repoData?.meta?.name]);

  // Check auth state on mount
  useEffect(() => {
    getAuthUser()
      .then(data => {
        if (data.authenticated) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  const handleAnalyzeCommit = useCallback((sha) => {
    setAnalyzerSha(sha);
    setTimeout(() => {
      commitAnalyzerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, []);

  const pulseMutation = useMutation({
    mutationFn: ({ repoUrl, forceRefresh }) => fetchPulseData(repoUrl, forceRefresh),
    onSuccess: (data) => {
      setPulseData(data);
      if (data.aiPending) {
        setAiPending(true);
      }
    },
  });

  const handleSubmit = (repoUrl) => {
    pulseMutation.mutate({ repoUrl, forceRefresh: false });
  };

  const handleForceRefresh = () => {
    const repoUrl = repoData?.meta?.fullName || repoData?.meta?.htmlUrl;
    if (repoUrl) {
      pulseMutation.mutate({ repoUrl, forceRefresh: true });
    }
  };

  const handleReset = () => {
    if (sseCleanupRef.current) sseCleanupRef.current();
    setPulseData(null);
    pulseMutation.reset();
    setUseManualInput(false);
    setAiPending(false);
    setLiveEvents([]);
  };

  const dismissLiveEvent = useCallback((id) => {
    setLiveEvents(prev => prev.filter(e => e.id !== id));
  }, []);

  const handleLogout = () => {
    setUser(null);
    setPulseData(null);
    pulseMutation.reset();
  };

  const repoData = pulseData?.repoData || (pulseData?.meta ? pulseData : null);
  const summary = pulseData?.summary || null;
  const summaryError = pulseData?.summaryError || null;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-pulse-500 to-pulse-700 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-gray-900">ProjectPulse</h1>
            </div>
            <div className="flex items-center space-x-4">
              {repoData && (
                <>
                  {/* Git Graph Button */}
                  <button
                    onClick={() => setShowGitGraph(true)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors group relative"
                    title="View Git Graph"
                  >
                    <svg 
                      className="w-5 h-5 text-gray-600 group-hover:text-pulse-600" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      {/* Tree/branch icon similar to VS Code Git Graph */}
                      <circle cx="6" cy="6" r="2" strokeWidth={2} />
                      <circle cx="18" cy="6" r="2" strokeWidth={2} />
                      <circle cx="6" cy="18" r="2" strokeWidth={2} />
                      <circle cx="18" cy="18" r="2" strokeWidth={2} />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 8v2c0 2 2 4 6 4s6-2 6-4V8" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 16v-2" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 16v-2" />
                    </svg>
                  </button>

                  {/* Collision Radar Button */}
                  <button
                    onClick={() => setShowCollisionRadar(true)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors group relative"
                    title="View Collision Radar"
                  >
                    <svg 
                      className="w-5 h-5 text-gray-600 group-hover:text-pulse-600" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      {/* Radar/target icon */}
                      <circle cx="12" cy="12" r="10" strokeWidth={2} />
                      <circle cx="12" cy="12" r="6" strokeWidth={2} />
                      <circle cx="12" cy="12" r="2" strokeWidth={2} />
                      <path strokeLinecap="round" strokeWidth={2} d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                    </svg>
                  </button>

{/* Health Checkup Button */}
                  <button
                    onClick={() => setShowHealthCheckup(true)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors group relative"
                    title="Health Checkup"
                  >
                    <svg 
                      className="w-5 h-5 text-gray-600 group-hover:text-green-600" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      {/* Heart/health icon */}
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </button>

                  {/* Kanban Board Button */}
                  {user && (
                    <button
                      onClick={() => setShowKanbanBoard(true)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors group relative"
                      title="Task Board"
                    >
                      <svg 
                        className="w-5 h-5 text-gray-600 group-hover:text-pulse-600" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        {/* Kanban/board icon */}
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </button>
                  )}

                  {/* Force Refresh Button */}
                  <button
                    onClick={handleForceRefresh}
                    disabled={pulseMutation.isPending}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors group relative disabled:opacity-50"
                    title="Refresh data (fetch full commit history)"
                  >
                    <svg 
                      className={`w-5 h-5 text-gray-600 group-hover:text-pulse-600 ${pulseMutation.isPending ? 'animate-spin' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>

                  <button
                    onClick={handleReset}
                    className="text-sm text-gray-600 hover:text-gray-900 flex items-center space-x-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span>New repo</span>
                  </button>
                </>
              )}
              {authChecked && <AuthButton user={user} onLogout={handleLogout} />}
            </div>
          </div>
        </div>
      </header>

{/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Empty State - Landing Page */}
        {!repoData && !pulseMutation.isPending && !pulseMutation.isError && (
          <div className="flex flex-col items-center justify-center min-h-[70vh]">
            {/* Main Heading */}
            <h2 className="text-4xl sm:text-5xl font-bold text-center text-gray-900 mb-4">
              Check your repo&apos;s pulse
            </h2>

            {/* Subheading */}
            <p className="text-lg text-gray-600 max-w-lg text-center mb-10">
              {user
                ? 'Select a repository from your GitHub account to get started.'
                : 'Get intelligent health summaries, activity insights, and blocker detection for any GitHub repository.'}
            </p>

            {/* Input Section */}
            {user && !useManualInput ? (
              <RepoSelector
                onSubmit={handleSubmit}
                isLoading={pulseMutation.isPending}
                onSwitchToManual={() => setUseManualInput(true)}
              />
            ) : (
              <div className="w-full max-w-xl">
                <RepoInput onSubmit={handleSubmit} isLoading={pulseMutation.isPending} />
                {user && (
                  <div className="text-center mt-4">
                    <button
                      onClick={() => setUseManualInput(false)}
                      className="text-sm text-gray-500 hover:text-gray-700 transition-colors underline"
                    >
                      or select from your repositories
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {pulseMutation.isPending && <LoadingState />}

        {/* Error State */}
        {pulseMutation.isError && (
          <ErrorDisplay
            error={pulseMutation.error}
            onRetry={() => handleSubmit(pulseMutation.variables)}
            onReset={handleReset}
          />
        )}

        {/* Dashboard Content */}
        {repoData && !pulseMutation.isPending && (
          <>
            <div className="mb-6">
              <RepoInput
                onSubmit={handleSubmit}
                isLoading={pulseMutation.isPending}
                initialValue={repoData.meta?.fullName || ''}
                compact
              />
            </div>

            {/* AI-Generated Pulse Summary */}
            <PulseSummary summary={summary} summaryError={summaryError} aiPending={aiPending} />

            {/* Blocker Detection Panel */}
            <BlockerPanel blockers={repoData.blockers} />

            {/* Project Playbook */}
            <PlaybookPanel 
              owner={repoData.meta.owner} 
              repo={repoData.meta.name} 
              refreshKey={playbookRefreshKey}
            />

            {/* Contributor Activity Heatmap */}
            <ContributorHeatmap contributors={repoData.contributors} />

            {/* Detailed Dashboard Content */}
            <DashboardContent data={repoData} onAnalyzeCommit={handleAnalyzeCommit} />

            {/* AI Commit Analyzer */}
            <CommitAnalyzer
              ref={commitAnalyzerRef}
              owner={repoData.meta.owner}
              repo={repoData.meta.name}
              initialSha={analyzerSha}
            />
          </>
        )}
      </main>

      {/* Floating Chat Panel */}
      {repoData && <ChatPanel repoData={repoData} />}

      {/* Live Event Toast Notifications */}
      <LiveEventToast events={liveEvents} onDismiss={dismissLiveEvent} />

      {/* Git Graph Panel Modal */}
      {showGitGraph && repoData && (
        <GitGraphPanel
          repoData={repoData}
          onClose={() => setShowGitGraph(false)}
        />
      )}

      {/* Collision Radar Panel Modal */}
      {showCollisionRadar && repoData && (
        <CollisionRadarPanel
          owner={repoData.meta.owner}
          repo={repoData.meta.name}
          onClose={() => setShowCollisionRadar(false)}
        />
      )}

{/* Health Checkup Panel Modal */}
      {showHealthCheckup && repoData && (
        <HealthCheckupPanel
          owner={repoData.meta.owner}
          repo={repoData.meta.name}
          onClose={() => setShowHealthCheckup(false)}
        />
      )}

      {/* Kanban Board Panel */}
      {showKanbanBoard && repoData && user && (
        <KanbanBoard
          owner={repoData.meta.owner}
          repo={repoData.meta.name}
          currentUser={user.login}
          onClose={() => setShowKanbanBoard(false)}
        />
      )}
    </div>
  );
}

export default Dashboard;
