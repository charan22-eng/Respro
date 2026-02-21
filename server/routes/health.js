/**
 * Health Routes
 * API endpoint for repository health checkup
 */

import express from 'express';
import { runHealthCheckup } from '../services/healthService.js';

const router = express.Router();

/**
 * Get GitHub token from session or environment
 */
function getToken(req) {
  return req.session?.githubToken || process.env.GITHUB_TOKEN || null;
}

/**
 * GET /api/health/:owner/:repo
 * Run comprehensive health checkup for a repository
 */
router.get('/health/:owner/:repo', async (req, res, next) => {
  try {
    const { owner, repo } = req.params;
    
    if (!owner || !repo) {
      return res.status(400).json({
        error: 'Missing owner or repo parameter',
        code: 'INVALID_INPUT'
      });
    }
    
    const token = getToken(req);
    const result = await runHealthCheckup(owner, repo, token);
    
    res.json(result);
    
  } catch (error) {
    console.error('Error running health checkup:', error.message);
    next(error);
  }
});

export default router;
