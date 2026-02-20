/**
 * SSE Service
 * Manages Server-Sent Events connections for real-time updates
 */

// Store active SSE connections by repo key
const connections = new Map();

/**
 * Get repo key from owner/repo
 */
function getRepoKey(owner, repo) {
  return `${owner.toLowerCase()}/${repo.toLowerCase()}`;
}

/**
 * Add a new SSE connection for a repo
 */
export function addConnection(owner, repo, res) {
  const key = getRepoKey(owner, repo);
  if (!connections.has(key)) {
    connections.set(key, new Set());
  }
  connections.get(key).add(res);
  console.log(`SSE: Client connected to ${key} (${connections.get(key).size} total)`);
}

/**
 * Remove an SSE connection
 */
export function removeConnection(owner, repo, res) {
  const key = getRepoKey(owner, repo);
  const clients = connections.get(key);
  if (clients) {
    clients.delete(res);
    if (clients.size === 0) {
      connections.delete(key);
    }
    console.log(`SSE: Client disconnected from ${key}`);
  }
}

/**
 * Broadcast an event to all connected clients for a repo
 */
export function broadcast(owner, repo, eventType, data) {
  const key = getRepoKey(owner, repo);
  const clients = connections.get(key);
  if (!clients || clients.size === 0) return;

  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  
  for (const res of clients) {
    try {
      res.write(message);
    } catch (err) {
      console.error('SSE write error:', err.message);
      clients.delete(res);
    }
  }
  console.log(`SSE: Broadcast ${eventType} to ${clients.size} clients on ${key}`);
}

/**
 * Get connection count for a repo
 */
export function getConnectionCount(owner, repo) {
  const key = getRepoKey(owner, repo);
  return connections.get(key)?.size || 0;
}

/**
 * Get all active repos (repos with at least one SSE connection)
 * Used by polling service to know which repos to check
 */
export function getActiveRepos() {
  const repos = [];
  for (const key of connections.keys()) {
    const [owner, repo] = key.split('/');
    if (owner && repo) {
      repos.push({ owner, repo });
    }
  }
  return repos;
}

export default { addConnection, removeConnection, broadcast, getConnectionCount, getActiveRepos };
