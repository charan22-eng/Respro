import PropTypes from 'prop-types';
import PulseSummary from '../components/PulseSummary';
import BlockerPanel from '../components/BlockerPanel';
import StatsGrid from '../components/StatsGrid';
import ActivityHeatmap from '../components/ActivityHeatmap';
import ContributorHeatmap from '../components/ContributorHeatmap';
import BranchList from '../components/BranchList';
import PullRequestList from '../components/PullRequestList';
import IssueList from '../components/IssueList';
import ContributorList from '../components/ContributorList';

function OverviewPage({ repoData, summary, summaryError, aiPending, onAnalyzeCommit }) {
  const { meta, commits, branches, pullRequests, issues, contributors, blockers, cached } = repoData;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Overview</h1>
          <p className="text-surface-500 mt-1">Repository health and activity summary</p>
        </div>
        {cached && (
          <div className="flex items-center gap-2 text-sm text-surface-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Cached data</span>
          </div>
        )}
      </div>

      {/* AI Summary Section */}
      <section>
        <PulseSummary summary={summary} summaryError={summaryError} aiPending={aiPending} />
      </section>

      {/* Blockers Section */}
      {blockers && blockers.length > 0 && (
        <section>
          <BlockerPanel blockers={blockers} />
        </section>
      )}

      {/* Stats Grid */}
      <section>
        <div className="section-header">
          <h2 className="section-title">Quick Stats</h2>
        </div>
        <StatsGrid
          commits={commits}
          branches={branches}
          pullRequests={pullRequests}
          issues={issues}
          contributors={contributors}
        />
      </section>

      {/* Activity Section */}
      <section>
        <div className="section-header">
          <h2 className="section-title">Activity Heatmap</h2>
          <span className="text-sm text-surface-500">Last 7 days</span>
        </div>
        <ActivityHeatmap commits={commits} contributors={contributors} />
      </section>

      {/* Contributor Heatmap */}
      <section>
        <div className="section-header">
          <h2 className="section-title">Contributor Activity</h2>
        </div>
        <ContributorHeatmap contributors={contributors} />
      </section>

      {/* Grid Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Branches */}
        <section>
          <BranchList branches={branches} />
        </section>

        {/* Pull Requests */}
        <section>
          <PullRequestList pullRequests={pullRequests} />
        </section>

        {/* Issues */}
        <section>
          <IssueList issues={issues} />
        </section>

        {/* Contributors */}
        <section>
          <ContributorList
            contributors={contributors}
            commits={commits}
            owner={meta.owner}
            repo={meta.name}
            onAnalyzeCommit={onAnalyzeCommit}
          />
        </section>
      </div>
    </div>
  );
}

OverviewPage.propTypes = {
  repoData: PropTypes.shape({
    meta: PropTypes.object.isRequired,
    commits: PropTypes.array,
    branches: PropTypes.array,
    pullRequests: PropTypes.array,
    issues: PropTypes.array,
    contributors: PropTypes.array,
    blockers: PropTypes.array,
    cached: PropTypes.bool,
  }).isRequired,
  summary: PropTypes.object,
  summaryError: PropTypes.string,
  aiPending: PropTypes.bool,
  onAnalyzeCommit: PropTypes.func,
};

export default OverviewPage;
