import { useState, useRef, useCallback, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import Sidebar from './components/Sidebar';
import LandingPage from './pages/LandingPage';
import OverviewPage from './pages/OverviewPage';
import InsightsPage from './pages/InsightsPage';
import ActivityPage from './pages/ActivityPage';
import CollaborationPage from './pages/CollaborationPage';
import TasksPage from './pages/TasksPage';
import ChatPanel from './components/ChatPanel';
import LiveEventToast from './components/LiveEventToast';
import LoadingState from './components/LoadingState';
import ErrorDisplay from './components/ErrorDisplay';
import RepoInput from './components/RepoInput';
import { fetchPulseData, getAuthUser, subscribeToUpdates } from './utils/api';

function App() {
  // Core state
  const [pulseData, setPulseData] = useState(null);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [aiPending, setAiPending] = useState(false);
  const [liveEvents, setLiveEvents] = useState([]);
  const [playbookRefreshKey, setPlaybookRefreshKey] = useState(0);
  
  // UI state
  const [activeView, setActiveView] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [analyzerSha, setAnalyzerSha] = useState('');
  
  // Refs
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
          setLiveEvents(prev => [...prev, { ...eventData, id: Date.now() }]);
          break;
          
        case 'event_processed':
          setLiveEvents(prev => 
            prev.map(e => e.commitId === eventData.commitId ? { ...eventData, id: e.id } : e)
          );
          setPulseData(prev => {
            if (!prev?.repoData?.commits) return prev;
            const newCommit = {
              sha: eventData.commitId,
              author: eventData.author,
              message: eventData.message,
              date: eventData.timestamp,
              branch: eventData.branch
            };
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

  // Mutation for fetching pulse data
  const pulseMutation = useMutation({
    mutationFn: ({ repoUrl, forceRefresh }) => fetchPulseData(repoUrl, forceRefresh),
    onSuccess: (data) => {
      setPulseData(data);
      if (data.aiPending) {
        setAiPending(true);
      }
    },
  });

  // Handlers
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
    setAiPending(false);
    setLiveEvents([]);
    setActiveView('overview');
  };

  const handleLogout = () => {
    setUser(null);
    setPulseData(null);
    pulseMutation.reset();
  };

  const handleAnalyzeCommit = useCallback((sha) => {
    setAnalyzerSha(sha);
    setActiveView('activity'); // Navigate to Activity page to show the analyzer
  }, []);

  const dismissLiveEvent = useCallback((id) => {
    setLiveEvents(prev => prev.filter(e => e.id !== id));
  }, []);

  const handleViewChange = (view) => {
    setActiveView(view);
  };

  // Derived state
  const repoData = pulseData?.repoData || (pulseData?.meta ? pulseData : null);
  const summary = pulseData?.summary || null;
  const summaryError = pulseData?.summaryError || null;
  const hasRepo = !!repoData;

  // Render the appropriate page content
  const renderPageContent = () => {
    if (!hasRepo) return null;

    switch (activeView) {
      case 'overview':
        return (
          <OverviewPage
            repoData={repoData}
            summary={summary}
            summaryError={summaryError}
            aiPending={aiPending}
            onAnalyzeCommit={handleAnalyzeCommit}
          />
        );
      case 'insights':
        return <InsightsPage repoData={repoData} />;
      case 'activity':
        return (
          <ActivityPage
            repoData={repoData}
            playbookRefreshKey={playbookRefreshKey}
            onAnalyzeCommit={handleAnalyzeCommit}
            initialAnalyzerSha={analyzerSha}
          />
        );
      case 'collaboration':
        return (
          <CollaborationPage
            repoData={repoData}
            onAnalyzeCommit={handleAnalyzeCommit}
          />
        );
      case 'tasks':
        return <TasksPage repoData={repoData} user={user} />;
      default:
        return (
          <OverviewPage
            repoData={repoData}
            summary={summary}
            summaryError={summaryError}
            aiPending={aiPending}
            onAnalyzeCommit={handleAnalyzeCommit}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Show landing page when no repo is selected */}
      {!hasRepo && !pulseMutation.isPending && !pulseMutation.isError && (
        <LandingPage
          user={user}
          onSubmit={handleSubmit}
          isLoading={pulseMutation.isPending}
        />
      )}

      {/* Loading State */}
      {pulseMutation.isPending && (
        <div className="min-h-screen flex items-center justify-center">
          <LoadingState />
        </div>
      )}

      {/* Error State */}
      {pulseMutation.isError && (
        <div className="min-h-screen flex items-center justify-center p-8">
          <ErrorDisplay
            error={pulseMutation.error}
            onRetry={() => handleSubmit(pulseMutation.variables?.repoUrl)}
            onReset={handleReset}
          />
        </div>
      )}

      {/* Main App Layout with Sidebar */}
      {hasRepo && !pulseMutation.isPending && (
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <Sidebar
            activeView={activeView}
            onViewChange={handleViewChange}
            repoData={repoData}
            user={user}
            onLogout={handleLogout}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            onLogoClick={handleReset}
          />

          {/* Main Content Area */}
          <main className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
            {/* Top Bar */}
            <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-surface-200">
              <div className="px-8 py-4">
                <div className="flex items-center justify-between">
                  {/* Repository Selector */}
                  <div className="flex-1 max-w-md">
                    <RepoInput
                      onSubmit={handleSubmit}
                      isLoading={pulseMutation.isPending}
                      initialValue={repoData.meta?.fullName || ''}
                      compact
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3">
                    {/* Force Refresh */}
                    <button
                      onClick={handleForceRefresh}
                      disabled={pulseMutation.isPending}
                      className="btn-ghost"
                      title="Refresh data"
                    >
                      <svg 
                        className={`w-4 h-4 ${pulseMutation.isPending ? 'animate-spin' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span className="hidden sm:inline">Refresh</span>
                    </button>

                    {/* New Repo */}
                    <button
                      onClick={handleReset}
                      className="btn-ghost"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span className="hidden sm:inline">New Repo</span>
                    </button>
                  </div>
                </div>
              </div>
            </header>

            {/* Page Content */}
            <div className="p-8">
              {renderPageContent()}
            </div>
          </main>

          {/* Floating Chat Panel */}
          <ChatPanel repoData={repoData} />

          {/* Live Event Toast Notifications */}
          <LiveEventToast events={liveEvents} onDismiss={dismissLiveEvent} />
        </div>
      )}
    </div>
  );
}

export default App;
