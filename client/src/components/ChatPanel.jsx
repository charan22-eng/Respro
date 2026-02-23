import { useState, useRef, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import { sendChatMessage } from '../utils/api';

/**
 * Trim repoData to only what the chat LLM needs
 */
function trimForChat(data) {
  if (!data) return data;
  return {
    meta: data.meta,
    commits: (data.commits || []).slice(0, 30),
    branches: (data.branches || []).slice(0, 20),
    pullRequests: (data.pullRequests || []).slice(0, 15),
    issues: (data.issues || []).slice(0, 15),
    contributors: (data.contributors || []).slice(0, 15),
    blockers: data.blockers || [],
    fetchedAt: data.fetchedAt
  };
}

/**
 * Generate smart suggestions based on repo state
 */
function generateSmartSuggestions(repoData) {
  const suggestions = [];
  const { pullRequests = [], issues = [], blockers = [], contributors = [], commits = [] } = repoData;

  // Always include some core questions
  suggestions.push({
    text: "Give me a quick project status update",
    icon: "pulse",
    category: "overview"
  });

  // PR-based suggestions
  if (pullRequests.length > 0) {
    suggestions.push({
      text: `What's the status of the ${pullRequests.length} open PRs?`,
      icon: "pr",
      category: "prs"
    });
    const oldestPR = pullRequests[pullRequests.length - 1];
    if (oldestPR) {
      suggestions.push({
        text: `Why is PR #${oldestPR.number} still open?`,
        icon: "pr",
        category: "prs"
      });
    }
  }

  // Issue-based suggestions
  if (issues.length > 0) {
    const bugIssues = issues.filter(i => i.labels?.some(l => l.name.toLowerCase().includes('bug')));
    if (bugIssues.length > 0) {
      suggestions.push({
        text: `Tell me about the ${bugIssues.length} bug${bugIssues.length > 1 ? 's' : ''} we need to fix`,
        icon: "bug",
        category: "issues"
      });
    }
  }

  // Blocker-based suggestions
  if (blockers.length > 0) {
    suggestions.push({
      text: `Explain the ${blockers.length} blocker${blockers.length > 1 ? 's' : ''} and how to resolve them`,
      icon: "warning",
      category: "blockers"
    });
  }

  // Contributor suggestions
  if (contributors.length > 1) {
    suggestions.push({
      text: "Who's been most active this week?",
      icon: "users",
      category: "team"
    });
    suggestions.push({
      text: "Are there any collaboration issues or work overlap?",
      icon: "collision",
      category: "team"
    });
  }

  // Commit activity suggestions
  if (commits.length > 0) {
    suggestions.push({
      text: "Summarize what changed in the last few days",
      icon: "commits",
      category: "activity"
    });
  }

  // Add a planning question
  suggestions.push({
    text: "What should the team focus on next?",
    icon: "target",
    category: "planning"
  });

  return suggestions.slice(0, 6);
}

/**
 * Icon component for suggestions
 */
function SuggestionIcon({ type }) {
  const icons = {
    pulse: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    pr: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    ),
    bug: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    warning: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    users: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
      </svg>
    ),
    collision: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    commits: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    target: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    )
  };
  return icons[type] || icons.pulse;
}

SuggestionIcon.propTypes = {
  type: PropTypes.string.isRequired
};

/**
 * Message component with markdown rendering
 */
function ChatMessage({ message, isStreaming }) {
  const isUser = message.role === 'user';
  const isError = message.isError;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
        isUser
          ? 'bg-surface-900 text-white'
          : isError
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-surface-100 text-surface-800'
      }`}>
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-headings:my-2 prose-code:bg-surface-200 prose-code:px-1 prose-code:rounded">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-surface-400 animate-pulse ml-0.5 align-middle rounded-full" />
        )}
      </div>
    </div>
  );
}

ChatMessage.propTypes = {
  message: PropTypes.object.isRequired,
  isStreaming: PropTypes.bool
};

/**
 * Main ChatPanel Component
 */
function ChatPanel({ repoData }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const smartSuggestions = useMemo(() => 
    generateSmartSuggestions(repoData), 
    [repoData]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSend = async (text) => {
    const messageText = text || input.trim();
    if (!messageText || isStreaming) return;

    const userMessage = { role: 'user', content: messageText };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsStreaming(true);
    setStreamingText('');

    try {
      const fullResponse = await sendChatMessage(
        updatedMessages,
        trimForChat(repoData),
        (_chunk, accumulated) => {
          setStreamingText(accumulated);
        }
      );

      setMessages(prev => [...prev, { role: 'assistant', content: fullResponse }]);
      setStreamingText('');
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message}`,
        isError: true
      }]);
      setStreamingText('');
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setStreamingText('');
  };

  // Floating button when closed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-slate-900 hover:bg-slate-800
                   text-white rounded-2xl shadow-2xl flex items-center justify-center
                   transition-all hover:scale-110 z-[9999] group border-2 border-slate-700"
        style={{ boxShadow: '0 10px 40px rgba(0, 0, 0, 0.4)' }}
        title="Ask GitSage"
      >
        <svg className="w-7 h-7 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {/* Notification dot when there are blockers */}
        {repoData.blockers?.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
            {repoData.blockers.length}
          </span>
        )}
      </button>
    );
  }

  const panelWidth = isExpanded ? 'w-[600px]' : 'w-[380px]';
  const panelHeight = isExpanded ? 'h-[600px]' : 'h-[500px]';

  return (
    <div className={`fixed bottom-6 right-6 ${panelWidth} ${panelHeight} bg-white rounded-2xl shadow-elevated
                    border border-slate-200 flex flex-col z-[9999] transition-all duration-200`}>
      {/* Header */}
      <div className="px-4 py-3 bg-slate-900 text-white rounded-t-2xl flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-sm text-white">Ask GitSage</h3>
            <p className="text-xs text-slate-300">{repoData.meta?.name || 'Repository'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
              title="Clear chat"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isExpanded ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              )}
            </svg>
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
            title="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Empty state with suggestions */}
        {messages.length === 0 && !isStreaming && (
          <div className="space-y-4">
            <div className="text-center py-2">
              <p className="text-sm text-surface-500">
                Ask me anything about <span className="font-medium text-surface-700">{repoData.meta?.name}</span>
              </p>
            </div>
            
            {/* Smart suggestions grid */}
            <div className="grid grid-cols-1 gap-2">
              {smartSuggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(suggestion.text)}
                  className="flex items-center gap-3 text-left text-sm px-3 py-2.5 rounded-xl
                             bg-surface-50 hover:bg-surface-100 border border-surface-200
                             hover:border-surface-300 transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-surface-200 group-hover:bg-surface-300 flex items-center justify-center text-surface-600 transition-colors">
                    <SuggestionIcon type={suggestion.icon} />
                  </div>
                  <span className="text-surface-700 group-hover:text-surface-900">{suggestion.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}

        {/* Streaming response */}
        {isStreaming && streamingText && (
          <ChatMessage 
            message={{ role: 'assistant', content: streamingText }} 
            isStreaming={true}
          />
        )}

        {/* Loading indicator */}
        {isStreaming && !streamingText && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-3 bg-surface-100">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-surface-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-surface-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                  <div className="w-2 h-2 bg-surface-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                </div>
                <span className="text-xs text-surface-500">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-3 border-t border-surface-200 flex-shrink-0 bg-surface-50 rounded-b-2xl">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            disabled={isStreaming}
            className="input-primary flex-1 text-sm"
          />
          <button
            onClick={() => handleSend()}
            disabled={isStreaming || !input.trim()}
            className="px-4 py-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700
                       disabled:bg-surface-300 disabled:cursor-not-allowed transition-colors
                       flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

ChatPanel.propTypes = {
  repoData: PropTypes.shape({
    meta: PropTypes.object.isRequired,
    commits: PropTypes.array,
    branches: PropTypes.array,
    pullRequests: PropTypes.array,
    issues: PropTypes.array,
    contributors: PropTypes.array,
    blockers: PropTypes.array
  }).isRequired
};

export default ChatPanel;
