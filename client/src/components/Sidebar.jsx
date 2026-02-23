import { useState } from 'react';
import PropTypes from 'prop-types';

const navigation = [
  {
    id: 'overview',
    label: 'Overview',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    ),
    description: 'Dashboard & Summary'
  },
  {
    id: 'insights',
    label: 'Insights',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    description: 'Health & Analytics'
  },
  {
    id: 'activity',
    label: 'Activity',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    description: 'Timeline & History'
  },
  {
    id: 'collaboration',
    label: 'Collaboration',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    description: 'Team & Collisions'
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    description: 'Kanban Board',
    requiresAuth: true
  },
];

function Sidebar({ activeView, onViewChange, repoData, user, onLogout, collapsed, onToggleCollapse, onLogoClick }) {
  const [hoveredItem, setHoveredItem] = useState(null);

  const repoName = repoData?.meta?.name || 'No Repository';
  const repoOwner = repoData?.meta?.owner || '';

  return (
    <aside className={`fixed left-0 top-0 h-screen bg-white border-r border-slate-200 flex flex-col z-40 transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'}`}>
      {/* Logo & Brand */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <button 
          onClick={onLogoClick}
          className={`flex items-center gap-3 ${collapsed ? 'justify-center w-full' : ''} hover:opacity-80 transition-opacity cursor-pointer`}
          title="Back to Home"
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img 
              src="/gitsage-logo.jpeg" 
              alt="GitSage Logo" 
              className="w-full h-full object-cover"
            />
          </div>
          {!collapsed && (
            <div className="text-left">
              <h1 className="text-lg font-bold" style={{ color: '#0f172a' }}>GitSage</h1>
              <p className="text-xs" style={{ color: '#64748b' }}>The brain behind your branches</p>
            </div>
          )}
        </button>
        <button
          onClick={onToggleCollapse}
          className={`p-2 rounded-lg hover:bg-slate-100 transition-colors ${collapsed ? 'hidden' : ''}`}
        >
          <svg className="w-4 h-4" style={{ color: '#64748b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Current Repository */}
      {repoData && (
        <div 
          className={`mx-3 mt-4 p-3 rounded-xl border ${collapsed ? 'mx-2 p-2' : ''}`}
          style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}
        >
          {collapsed ? (
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto"
              style={{ background: '#e2e8f0' }}
            >
              <svg className="w-4 h-4" style={{ color: '#475569' }} fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-4 h-4" style={{ color: '#64748b' }} fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium truncate" style={{ color: '#0f172a' }}>{repoName}</span>
              </div>
              <p className="text-xs truncate" style={{ color: '#64748b' }}>{repoOwner}</p>
            </>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {!collapsed && (
          <p 
            className="px-3 py-2 text-xs font-semibold uppercase tracking-wider"
            style={{ color: '#94a3b8' }}
          >
            Navigation
          </p>
        )}
        {navigation.map((item) => {
          // Skip tasks if no auth
          if (item.requiresAuth && !user) return null;
          
          const isActive = activeView === item.id;
          const isDisabled = !repoData && item.id !== 'overview';

          return (
            <div key={item.id} className="relative">
              <button
                onClick={() => !isDisabled && onViewChange(item.id)}
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
                disabled={isDisabled}
                className={`
                  relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                  ${collapsed ? 'justify-center' : ''}
                  ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                `}
                style={{
                  background: isActive ? '#eff6ff' : 'transparent',
                  color: isActive ? '#1d4ed8' : '#475569'
                }}
              >
                {isActive && (
                  <div 
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full"
                    style={{ background: '#3b82f6' }}
                  />
                )}
                <span style={{ color: isActive ? '#2563eb' : '#64748b' }}>{item.icon}</span>
                {!collapsed && (
                  <span 
                    className="text-sm font-medium"
                    style={{ color: isActive ? '#1d4ed8' : '#334155' }}
                  >
                    {item.label}
                  </span>
                )}
              </button>
              
              {/* Tooltip for collapsed state */}
              {collapsed && hoveredItem === item.id && (
                <div 
                  className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-2 text-white text-sm rounded-lg whitespace-nowrap z-50 shadow-lg"
                  style={{ background: '#0f172a' }}
                >
                  {item.label}
                  <div 
                    className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent"
                    style={{ borderRightColor: '#0f172a' }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User section */}
      <div className={`border-t p-3 ${collapsed ? 'px-2' : ''}`} style={{ borderColor: '#e2e8f0' }}>
        {user ? (
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
            <img
              src={user.avatar_url}
              alt={user.login}
              className="w-9 h-9 rounded-full ring-2"
              style={{ ringColor: '#e2e8f0' }}
            />
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: '#0f172a' }}>{user.name || user.login}</p>
                <p className="text-xs truncate" style={{ color: '#64748b' }}>@{user.login}</p>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={onLogout}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                title="Sign out"
              >
                <svg className="w-4 h-4" style={{ color: '#64748b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <a
            href="/api/auth/github"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-white transition-all ${collapsed ? 'justify-center px-2' : ''}`}
            style={{ background: '#0f172a' }}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            {!collapsed && <span className="text-sm font-medium">Sign in with GitHub</span>}
          </a>
        )}
      </div>

      {/* Collapse toggle for collapsed state */}
      {collapsed && (
        <button
          onClick={onToggleCollapse}
          className="mx-auto mb-4 p-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <svg className="w-4 h-4" style={{ color: '#64748b' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </aside>
  );
}

Sidebar.propTypes = {
  activeView: PropTypes.string.isRequired,
  onViewChange: PropTypes.func.isRequired,
  repoData: PropTypes.object,
  user: PropTypes.object,
  onLogout: PropTypes.func.isRequired,
  collapsed: PropTypes.bool,
  onToggleCollapse: PropTypes.func.isRequired,
  onLogoClick: PropTypes.func.isRequired,
};

export default Sidebar;
