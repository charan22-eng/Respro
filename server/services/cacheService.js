/**
 * Version-Based Cache Service
 * Cache invalidates when commit SHA changes, not by TTL
 * This enables real-time updates via webhooks while still caching for performance
 */

import fs from 'fs/promises';
import path from 'path';

const CACHE_DIR = process.env.CACHE_DIR || path.join(process.cwd(), '.cache');
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours max (safety cleanup)

// In-memory cache backed by disk
let memoryCache = {};
let cacheLoaded = false;

function getCacheFilePath() {
  return path.join(CACHE_DIR, 'pulse-cache.json');
}

/**
 * Load cache from disk on startup
 */
async function loadCache() {
  if (cacheLoaded) return;
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const data = await fs.readFile(getCacheFilePath(), 'utf-8');
    memoryCache = JSON.parse(data);
    
    // Clean very old entries (safety net)
    const now = Date.now();
    for (const key of Object.keys(memoryCache)) {
      const entry = memoryCache[key];
      if (entry.cachedAt && (now - new Date(entry.cachedAt).getTime()) > MAX_CACHE_AGE_MS) {
        delete memoryCache[key];
      }
    }
    console.log(`Loaded ${Object.keys(memoryCache).length} cached entries from disk`);
  } catch {
    memoryCache = {};
  }
  cacheLoaded = true;
}

/**
 * Save cache to disk (debounced)
 */
let saveTimeout = null;
async function saveCache() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
      await fs.writeFile(getCacheFilePath(), JSON.stringify(memoryCache, null, 2));
    } catch (err) {
      console.error('Failed to save cache:', err.message);
    }
  }, 1000);
}

/**
 * Generate cache key from repo URL
 */
function getCacheKey(repoUrl) {
  const urlPattern = /github\.com\/([^\/]+)\/([^\/]+)/;
  const shortPattern = /^([^\/]+)\/([^\/]+)$/;
  let match = repoUrl.match(urlPattern);
  if (match) return `repo:${match[1].toLowerCase()}/${match[2].replace(/\.git$/, '').toLowerCase()}`;
  match = repoUrl.trim().match(shortPattern);
  if (match) return `repo:${match[1].toLowerCase()}/${match[2].replace(/\.git$/, '').toLowerCase()}`;
  return repoUrl;
}

/**
 * Get cached data - validates against current version (SHA)
 * @param {string} repoUrl - Repository URL or key
 * @param {string} currentVersion - Current latest commit SHA (optional)
 * @returns {object|null} Cached data if version matches, null otherwise
 */
export async function getCachedData(repoUrl, currentVersion = null) {
  await loadCache();
  const key = typeof repoUrl === 'string' && repoUrl.includes(':') ? repoUrl : getCacheKey(repoUrl);
  const entry = memoryCache[key];
  
  if (!entry) {
    return null;
  }
  
  // If currentVersion provided, check if cache is still valid
  if (currentVersion && entry.version && entry.version !== currentVersion) {
    console.log(`Cache stale: ${key} (cached: ${entry.version?.substring(0, 7)}, current: ${currentVersion.substring(0, 7)})`);
    delete memoryCache[key];
    return null;
  }
  
  console.log(`Cache hit: ${key}${entry.version ? ` (version: ${entry.version.substring(0, 7)})` : ''}`);
  return entry.data;
}

/**
 * Store data in cache with version
 * @param {string} repoUrl - Repository URL or key
 * @param {object} data - Data to cache
 * @param {string} version - Version identifier (typically latest commit SHA)
 */
export async function setCachedData(repoUrl, data, version = null) {
  await loadCache();
  const key = typeof repoUrl === 'string' && repoUrl.includes(':') ? repoUrl : getCacheKey(repoUrl);
  memoryCache[key] = {
    data,
    version,
    cachedAt: new Date().toISOString()
  };
  console.log(`Cached: ${key}${version ? ` (version: ${version.substring(0, 7)})` : ''}`);
  saveCache();
}

/**
 * Update just the version for an entry (without changing data)
 * Useful for marking cache as stale without deleting it
 */
export async function updateCacheVersion(repoUrl, newVersion) {
  await loadCache();
  const key = typeof repoUrl === 'string' && repoUrl.includes(':') ? repoUrl : getCacheKey(repoUrl);
  if (memoryCache[key]) {
    memoryCache[key].version = newVersion;
    saveCache();
  }
}

/**
 * Invalidate cache entry (or entries matching a pattern)
 */
export async function invalidateCache(repoUrl) {
  await loadCache();
  const key = typeof repoUrl === 'string' && repoUrl.includes(':') ? repoUrl : getCacheKey(repoUrl);
  
  // Delete exact match
  if (memoryCache[key]) {
    delete memoryCache[key];
    console.log(`Cache invalidated: ${key}`);
  }
  
  // Also delete any keys containing this repo (for partial invalidation like "owner/repo")
  const repoPattern = repoUrl.toLowerCase().replace(/^repo:/, '');
  for (const k of Object.keys(memoryCache)) {
    if (k.includes(repoPattern)) {
      delete memoryCache[k];
      console.log(`Cache invalidated (pattern match): ${k}`);
    }
  }
  
  saveCache();
}

/**
 * Get the cached version (SHA) for a repo
 */
export async function getCachedVersion(repoUrl) {
  await loadCache();
  const key = typeof repoUrl === 'string' && repoUrl.includes(':') ? repoUrl : getCacheKey(repoUrl);
  return memoryCache[key]?.version || null;
}

/**
 * Get cache stats
 */
export function getCacheStats() {
  return { keys: Object.keys(memoryCache).length };
}

/**
 * Clear all cache
 */
export async function clearCache() {
  memoryCache = {};
  saveCache();
}

export default { 
  getCachedData, 
  setCachedData, 
  invalidateCache, 
  getCachedVersion,
  updateCacheVersion,
  getCacheStats, 
  clearCache 
};
