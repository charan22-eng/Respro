/**
 * Collision Routes
 * API endpoints for detecting work overlap/collisions
 */

import express from 'express';
import { detectCollisions, getCollisionSummary, resolveCollision, unresolveCollision } from '../services/collisionService.js';

const router = express.Router();

/**
 * Get GitHub token from session or environment
 */
function getToken(req) {
  return req.session?.githubToken || process.env.GITHUB_TOKEN || null;
}

/**
 * GET /api/collisions/:owner/:repo
 * Get full collision report for a repository
 */
router.get('/collisions/:owner/:repo', async (req, res, next) => {
  try {
    const { owner, repo } = req.params;
    
    if (!owner || !repo) {
      return res.status(400).json({
        error: 'Missing owner or repo parameter',
        code: 'INVALID_INPUT'
      });
    }
    
    const token = getToken(req);
    const result = await detectCollisions(owner, repo, token);
    res.json(result);
    
  } catch (error) {
    console.error('Error detecting collisions:', error.message);
    next(error);
  }
});

/**
 * GET /api/collisions/:owner/:repo/summary
 * Get lightweight collision summary for dashboard
 */
router.get('/collisions/:owner/:repo/summary', async (req, res, next) => {
  try {
    const { owner, repo } = req.params;
    
    if (!owner || !repo) {
      return res.status(400).json({
        error: 'Missing owner or repo parameter',
        code: 'INVALID_INPUT'
      });
    }
    
    const token = getToken(req);
    const result = await getCollisionSummary(owner, repo, token);
    res.json(result);
    
  } catch (error) {
    console.error('Error getting collision summary:', error.message);
    next(error);
  }
});

/**
 * POST /api/collisions/:owner/:repo/resolve
 * Mark a collision as resolved
 */
router.post('/collisions/:owner/:repo/resolve', async (req, res, next) => {
  try {
    const { owner, repo } = req.params;
    const { collisionId } = req.body;
    
    if (!owner || !repo || !collisionId) {
      return res.status(400).json({
        error: 'Missing owner, repo, or collisionId',
        code: 'INVALID_INPUT'
      });
    }
    
    const resolvedBy = req.session?.user?.login || 'anonymous';
    const result = await resolveCollision(owner, repo, collisionId, resolvedBy);
    
    res.json(result);
    
  } catch (error) {
    console.error('Error resolving collision:', error.message);
    next(error);
  }
});

/**
 * POST /api/collisions/:owner/:repo/unresolve
 * Bring back a resolved collision
 */
router.post('/collisions/:owner/:repo/unresolve', async (req, res, next) => {
  try {
    const { owner, repo } = req.params;
    const { collisionId } = req.body;
    
    if (!owner || !repo || !collisionId) {
      return res.status(400).json({
        error: 'Missing owner, repo, or collisionId',
        code: 'INVALID_INPUT'
      });
    }
    
    const result = await unresolveCollision(owner, repo, collisionId);
    
    res.json(result);
    
  } catch (error) {
    console.error('Error unresolving collision:', error.message);
    next(error);
  }
});

export default router;
