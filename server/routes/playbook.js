/**
 * Playbook Routes
 * API endpoints for reading playbook data
 */

import express from 'express';
import { getProjectPlaybook, getAllContributorPlaybooks } from '../services/playbookService.js';
import { getCachedData, setCachedData } from '../services/cacheService.js';

const router = express.Router();

/**
 * GET /api/playbook/:owner/:repo
 * Returns the full project playbook + all contributor playbooks
 */
router.get('/playbook/:owner/:repo', async (req, res, next) => {
  try {
    const { owner, repo } = req.params;

    const cacheKey = `playbook:${owner.toLowerCase()}/${repo.toLowerCase()}`;
    const cached = getCachedData(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const project = await getProjectPlaybook(owner, repo);
    if (!project) {
      return res.json({ project: null, contributors: {} });
    }

    const contributors = await getAllContributorPlaybooks(owner, repo);

    const result = { project, contributors };
    setCachedData(cacheKey, result);

    res.json(result);
  } catch (error) {
    console.error('Error fetching playbook:', error.message);
    next(error);
  }
});

export default router;
