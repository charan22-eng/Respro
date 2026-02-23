import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { getHealthCheckup } from '../utils/api';

/**
 * Grade Badge Component
 */
function GradeBadge({ grade, size = 'medium' }) {
  const getGradeStyle = (g) => {
    const letter = g.charAt(0);
    switch (letter) {
      case 'A': return 'bg-emerald-600 text-white';
      case 'B': return 'bg-blue-600 text-white';
      case 'C': return 'bg-amber-500 text-white';
      case 'D': return 'bg-orange-600 text-white';
      case 'F': return 'bg-red-600 text-white';
      default: return 'bg-slate-600 text-white';
    }
  };

  const sizeClasses = {
    small: 'w-10 h-10 text-lg',
    medium: 'w-16 h-16 text-2xl',
    large: 'w-24 h-24 text-4xl',
  };

  return (
    <div className={`${sizeClasses[size]} ${getGradeStyle(grade)} rounded-2xl flex items-center justify-center font-bold shadow-lg`}>
      {grade}
    </div>
  );
}

GradeBadge.propTypes = {
  grade: PropTypes.string.isRequired,
  size: PropTypes.string,
};

/**
 * Score Progress Bar
 */
function ScoreBar({ score, color, showLabel = true }) {
  const getBarColor = (c) => {
    switch (c) {
      case 'green': return 'bg-gradient-to-r from-emerald-400 to-emerald-500';
      case 'blue': return 'bg-gradient-to-r from-blue-400 to-blue-500';
      case 'yellow': return 'bg-gradient-to-r from-yellow-400 to-amber-500';
      case 'orange': return 'bg-gradient-to-r from-orange-400 to-orange-500';
      case 'red': return 'bg-gradient-to-r from-red-400 to-red-500';
      default: return 'bg-gradient-to-r from-surface-400 to-surface-500';
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2.5 bg-surface-100 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-700 ease-out ${getBarColor(color)}`}
          style={{ width: `${score}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-sm font-semibold text-surface-700 w-12 text-right">{score}%</span>
      )}
    </div>
  );
}

ScoreBar.propTypes = {
  score: PropTypes.number.isRequired,
  color: PropTypes.string.isRequired,
  showLabel: PropTypes.bool,
};

/**
 * Category Card
 */
function CategoryCard({ category, isExpanded, onToggle }) {
  const getGradeBgStyle = (g) => {
    const letter = g.charAt(0);
    switch (letter) {
      case 'A': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'B': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'C': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'D': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'F': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-surface-50 text-surface-700 border-surface-200';
    }
  };

  return (
    <div className="premium-card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-6 py-5 flex items-center justify-between hover:bg-surface-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold border ${getGradeBgStyle(category.grade)}`}>
            {category.grade}
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-surface-900">{category.category}</h3>
            <div className="mt-2 w-48">
              <ScoreBar score={category.score} color={category.color} showLabel={false} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold text-surface-900">{category.score}</span>
          <svg 
            className={`w-5 h-5 text-surface-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isExpanded && (
        <div className="px-6 pb-6 border-t border-surface-100 animate-slide-up">
          {/* Findings */}
          {category.findings && category.findings.length > 0 && (
            <div className="mt-5">
              <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Findings</h4>
              <div className="space-y-2">
                {category.findings.map((finding, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-surface-50 rounded-xl">
                    {finding.type === 'success' && (
                      <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    {finding.type === 'warning' && (
                      <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    {finding.type === 'info' && (
                      <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-surface-900">{finding.message}</p>
                      {finding.detail && (
                        <p className="text-xs text-surface-500 mt-0.5">{finding.detail}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suggestions */}
          {category.suggestions && category.suggestions.length > 0 && (
            <div className="mt-5">
              <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Suggestions</h4>
              <ul className="space-y-2">
                {category.suggestions.map((suggestion, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-surface-600">
                    <svg className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Metrics */}
          {category.metrics && Object.keys(category.metrics).length > 0 && (
            <div className="mt-5">
              <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-3">Metrics</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(category.metrics).map(([key, value]) => (
                  <div key={key} className="bg-surface-50 rounded-xl p-3 text-center">
                    <div className="text-lg font-bold text-surface-900">
                      {typeof value === 'number' ? value.toLocaleString() : value || '-'}
                    </div>
                    <div className="text-xs text-surface-500 capitalize mt-1">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

CategoryCard.propTypes = {
  category: PropTypes.object.isRequired,
  isExpanded: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
};

/**
 * Main Insights Page
 */
function InsightsPage({ repoData }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState(new Set([0]));

  const { owner, name: repo } = repoData.meta;

  const fetchData = useCallback(() => {
    if (!owner || !repo) return;

    setLoading(true);
    setError(null);

    getHealthCheckup(owner, repo)
      .then(result => {
        setData(result);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch health checkup:', err);
        setError(err.message);
        setLoading(false);
      });
  }, [owner, repo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleCategory = (index) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Insights</h1>
          <p className="text-surface-500 mt-1">Health analysis and recommendations</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="btn-ghost"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-4" />
          <p className="text-surface-500">Running health analysis...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="premium-card p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-surface-900 mb-2">Analysis Failed</h3>
          <p className="text-surface-500 mb-4">{error}</p>
          <button onClick={fetchData} className="btn-primary">
            Try Again
          </button>
        </div>
      )}

      {/* Data Display */}
      {!loading && !error && data && (
        <>
          {/* Overall Score Card */}
          <div className="premium-card p-8">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <GradeBadge grade={data.overall.grade} size="large" />
              <div className="flex-1 text-center md:text-left">
                <div className="flex items-baseline gap-2 justify-center md:justify-start mb-3">
                  <span className="text-5xl font-bold text-surface-900">{data.overall.score}</span>
                  <span className="text-xl text-surface-400">/ 100</span>
                </div>
                <p className="text-surface-600 leading-relaxed max-w-xl">
                  {data.overall.summary}
                </p>
              </div>
            </div>
          </div>

          {/* Top Recommendations */}
          {data.overall.topSuggestions?.length > 0 && (
            <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl p-6 shadow-elevated border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-4">
                Top Recommendations
              </h3>
              <ul className="space-y-4">
                {data.overall.topSuggestions.map((suggestion, idx) => (
                  <li key={idx} className="flex items-start gap-4">
                    <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-brand-600 text-white text-sm font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-slate-900 leading-relaxed">{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Category Breakdown */}
          <div>
            <h3 className="text-sm font-semibold text-surface-500 uppercase tracking-wider mb-4">
              Category Breakdown
            </h3>
            <div className="space-y-4">
              {data.categories.map((category, idx) => (
                <CategoryCard
                  key={category.category}
                  category={category}
                  isExpanded={expandedCategories.has(idx)}
                  onToggle={() => toggleCategory(idx)}
                />
              ))}
            </div>
          </div>

          {/* Footer Info */}
          {data.repoInfo && (
            <p className="text-sm text-surface-400 text-center">
              Analysis based on {data.repoInfo.totalCommits} commits
              {data.repoInfo.techAreas?.length > 0 && ` across ${data.repoInfo.techAreas.length} technology areas`}
            </p>
          )}
        </>
      )}
    </div>
  );
}

InsightsPage.propTypes = {
  repoData: PropTypes.shape({
    meta: PropTypes.shape({
      owner: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
};

export default InsightsPage;
