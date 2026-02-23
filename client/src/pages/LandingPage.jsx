import { useState } from 'react';
import PropTypes from 'prop-types';
import RepoInput from '../components/RepoInput';
import RepoSelector from '../components/RepoSelector';

const features = [
  {
    id: 'health',
    title: 'Health Analysis',
    description: 'Get comprehensive health scores and grades across documentation, testing, code quality, and more.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24">
        <path stroke="#10b981" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
    iconBg: '#ecfdf5',
  },
  {
    id: 'insights',
    title: 'AI-Powered Insights',
    description: 'Intelligent analysis of commits, blockers, and project trajectory using advanced AI models.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24">
        <path stroke="#3b82f6" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    iconBg: '#eff6ff',
  },
  {
    id: 'collision',
    title: 'Collision Detection',
    description: 'Identify overlapping work between team members and prevent merge conflicts early.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24">
        <path stroke="#f59e0b" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    iconBg: '#fffbeb',
  },
  {
    id: 'playbook',
    title: 'Project Playbook',
    description: 'Track every commit with AI-generated summaries showing before, after, and impact.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24">
        <path stroke="#a855f7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    iconBg: '#faf5ff',
  },
  {
    id: 'git-graph',
    title: 'Visual Git Graph',
    description: 'Interactive commit visualization with branch history similar to VS Code Git Graph.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24">
        <circle cx="6" cy="6" r="2" stroke="#06b6d4" strokeWidth={1.5} />
        <circle cx="18" cy="6" r="2" stroke="#06b6d4" strokeWidth={1.5} />
        <circle cx="6" cy="18" r="2" stroke="#06b6d4" strokeWidth={1.5} />
        <circle cx="18" cy="18" r="2" stroke="#06b6d4" strokeWidth={1.5} />
        <path stroke="#06b6d4" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 8v2c0 2 2 4 6 4s6-2 6-4V8M6 16v-2M18 16v-2" />
      </svg>
    ),
    iconBg: '#ecfeff',
  },
  {
    id: 'kanban',
    title: 'Task Management',
    description: 'Built-in Kanban board with deadlines, priorities, and contributor assignments.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24">
        <path stroke="#f43f5e" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    iconBg: '#fff1f2',
  },
];

function LandingPage({ user, onSubmit, isLoading }) {
  const [useManualInput, setUseManualInput] = useState(false);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background decoration - pointer-events-none to prevent click blocking */}
        <div className="absolute inset-0 bg-animated-gradient opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2 pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-6 py-16 md:py-24">
          <div className="text-center mb-12">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <img 
                src="/gitsage-logo.jpeg" 
                alt="GitSage Logo" 
                className="w-24 h-24 md:w-32 md:h-32 rounded-2xl shadow-xl"
              />
            </div>

            {/* Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 tracking-tight" style={{ color: '#0f172a' }}>
              Meet <span className="gradient-text">GitSage</span>
            </h1>
            <p className="text-xl md:text-2xl font-medium mb-2" style={{ color: '#334155' }}>
              The brain behind your branches
            </p>

            {/* Subheadline */}
            <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed" style={{ color: '#475569' }}>
              {user
                ? 'Select a repository from your GitHub account or enter any public repo URL to get started.'
                : 'Get intelligent health summaries, activity insights, and blocker detection for any GitHub repository.'}
            </p>

            {/* Input Section */}
            <div className="max-w-xl mx-auto">
              {user && !useManualInput ? (
                <RepoSelector
                  onSubmit={onSubmit}
                  isLoading={isLoading}
                  onSwitchToManual={() => setUseManualInput(true)}
                />
              ) : (
                <div>
                  <RepoInput onSubmit={onSubmit} isLoading={isLoading} />
                  {user && (
                    <button
                      onClick={() => setUseManualInput(false)}
                      className="mt-4 text-sm hover:text-slate-700 transition-colors underline underline-offset-4"
                      style={{ color: '#64748b' }}
                    >
                      or select from your repositories
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: '#0f172a' }}>
            Everything you need to monitor repository health
          </h2>
          <p className="max-w-2xl mx-auto" style={{ color: '#475569' }}>
            Comprehensive tools for tracking activity, detecting issues, and improving team collaboration.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={feature.id}
              className="premium-card p-6 group animate-slide-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div 
                className="feature-icon mb-4 w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: feature.iconBg }}
              >
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-blue-600 transition-colors" style={{ color: '#0f172a' }}>
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: '#475569' }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      {!user && (
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="premium-card p-8 md:p-12 text-center relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl" />
            
            <div className="relative">
              <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: '#0f172a' }}>
                Get more with GitHub authentication
              </h2>
              <p className="max-w-xl mx-auto mb-8" style={{ color: '#475569' }}>
                Sign in to access private repositories, create webhooks for real-time updates, 
                and use the Kanban board for task management.
              </p>
              <a
                href="/api/auth/github"
                className="btn-primary inline-flex"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                Sign in with GitHub
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

LandingPage.propTypes = {
  user: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
};

export default LandingPage;
