import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { Mutex } from 'async-mutex';
import { indexCodebase } from './ragService.js';

const execAsync = promisify(exec);
const REPOS_DIR = process.env.REPOS_DIR || path.join(process.cwd(), '.repos');

// Prevent concurrent fetches on the same repo
const repoMutexes = new Map();
function getRepoMutex(owner, repo) {
  const key = `${owner}/${repo}`;
  if (!repoMutexes.has(key)) {
    repoMutexes.set(key, new Mutex());
  }
  return repoMutexes.get(key);
}

function getRepoPath(owner, repo) {
  return path.join(REPOS_DIR, `${owner}-${repo}.git`);
}

/**
 * Ensures a bare clone of the repository exists and is up to date.
 */
export async function ensureClone(owner, repo, token = null) {
  const repoPath = getRepoPath(owner, repo);
  const mutex = getRepoMutex(owner, repo);
  const release = await mutex.acquire();
  
  try {
    const authUrl = `https://github.com/${owner}/${repo}.git`;
    
    // Pass token securely via extraHeader instead of embedding in URL
    const b64Token = token ? Buffer.from(`x-access-token:${token}`).toString('base64') : '';
    const extraHeader = token ? `-c http.extraHeader="AUTHORIZATION: basic ${b64Token}"` : '';
      
    try {
      await fs.access(repoPath);
      // Exists, just fetch latest
      console.log(`[CloneService] Fetching latest for ${owner}/${repo}...`);
      await execAsync(`git ${extraHeader} fetch origin "+refs/heads/*:refs/heads/*" --prune`, { cwd: repoPath });
    } catch {
      // Doesn't exist, create bare clone
      console.log(`[CloneService] Creating bare clone for ${owner}/${repo}...`);
      await fs.mkdir(REPOS_DIR, { recursive: true });
      await execAsync(`git ${extraHeader} clone --bare ${authUrl} ${repoPath}`);
      
      // Initial codebase indexing (fire and forget in background)
      indexCodebase(owner, repo).catch(err => console.error('[CloneService] Initial RAG indexing failed:', err));
    }
    return repoPath;
  } catch (error) {
    console.error(`[CloneService] Error syncing ${owner}/${repo}:`, error.message);
    throw error;
  } finally {
    release();
  }
}

/**
 * Cleans up bare clones that haven't been accessed/fetched in 7 days.
 */
export async function cleanupUnusedClones() {
  try {
    const files = await fs.readdir(REPOS_DIR);
    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    
    for (const file of files) {
      if (!file.endsWith('.git')) continue;
      
      const repoPath = path.join(REPOS_DIR, file);
      const stats = await fs.stat(repoPath);
      
      // Check last modified time
      if (now - stats.mtimeMs > SEVEN_DAYS_MS) {
        console.log(`[CloneService] Cleaning up inactive clone: ${file}`);
        await fs.rm(repoPath, { recursive: true, force: true });
      }
    }
  } catch (error) {
    // Ignore errors if directory doesn't exist yet
    if (error.code !== 'ENOENT') {
      console.error('[CloneService] Failed to clean up clones:', error.message);
    }
  }
}
