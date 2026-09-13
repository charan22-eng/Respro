import { exec } from 'child_process';
import { promisify } from 'util';
import { ensureClone } from './cloneService.js';

const execAsync = promisify(exec);

/**
 * Simulates a merge between two branches and detects ground-truth conflicts.
 * Uses `git merge-tree --write-tree` on the bare clone.
 */
export async function simulateMerge(owner, repo, branch1, branch2, token = null) {
  try {
    const repoPath = await ensureClone(owner, repo, token);
    
    // git merge-tree exits with 1 if there are conflicts
    let stdout, stderr;
    let hasConflicts = false;
    
    // Verify both branches exist before attempting merge-tree
    try {
      await execAsync(`git rev-parse --verify refs/heads/${branch1}`, { cwd: repoPath });
      await execAsync(`git rev-parse --verify refs/heads/${branch2}`, { cwd: repoPath });
    } catch (err) {
      console.warn(`[MergeSimulation] One or both branches do not exist in the clone: ${branch1}, ${branch2}`);
      return { hasConflicts: false, error: 'Branch missing' };
    }

    try {
      // NOTE: Using refs/heads/... explicitly to ensure we resolve branches correctly in bare clone
      const result = await execAsync(`git merge-tree --write-tree refs/heads/${branch1} refs/heads/${branch2}`, { cwd: repoPath });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (error) {
      // If error.code === 1, it means there are conflicts. If it's something else, it's a real error.
      if (error.code === 1) {
        hasConflicts = true;
        stdout = error.stdout;
        stderr = error.stderr;
      } else {
        throw error;
      }
    }

    if (!hasConflicts) {
      return { hasConflicts: false, conflictedFiles: [] };
    }

    // Parse the output
    // The output format is:
    // <tree_hash>
    // 
    // <conflicted_file_1>
    // <conflicted_file_2>
    // ...
    // 
    // And then formatted diff hunks if it's not a binary file
    
    const lines = stdout.split('\n');
    // First line is tree hash, second is empty. Following lines until next empty line are conflicted files.
    const conflictedFiles = [];
    let i = 2; // skip tree hash and empty line
    while (i < lines.length && lines[i].trim() !== '') {
      conflictedFiles.push(lines[i].trim());
      i++;
    }
    
    // The rest of the output contains the actual diff hunks which we can capture
    const conflictDiff = lines.slice(i).join('\n').trim();

    return {
      hasConflicts: true,
      conflictedFiles,
      conflictDiff,
      effortEstimate: calculateEffort(conflictedFiles.length, conflictDiff)
    };
    
  } catch (error) {
    console.error(`[MergeSimulation] Failed to simulate merge for ${owner}/${repo}:`, error.message);
    return { hasConflicts: false, error: error.message }; // Fail open
  }
}

function calculateEffort(fileCount, diff) {
  if (fileCount === 0) return 'None';
  
  // Count conflict markers
  const conflictCount = (diff.match(/<<<<<<< /g) || []).length;
  
  if (conflictCount > 10 || fileCount > 5) return 'High';
  if (conflictCount > 3 || fileCount > 2) return 'Medium';
  return 'Low';
}
