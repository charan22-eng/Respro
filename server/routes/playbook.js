/**
 * Playbook Routes
 * API endpoints for reading playbook data
 */

import express from 'express';
import { getProjectPlaybook, getAllContributorPlaybooks } from '../services/playbookService.js';

const router = express.Router();

/**
 * GET /api/playbook/:owner/:repo
 * Returns the full project playbook + all contributor playbooks
 * Note: No caching here - playbook files are the source of truth
 * and update in real-time via webhooks
 */
router.get('/playbook/:owner/:repo', async (req, res, next) => {
  try {
    const { owner, repo } = req.params;

    const project = await getProjectPlaybook(owner, repo);
    if (!project) {
      return res.json({ project: null, contributors: {} });
    }

    const contributors = await getAllContributorPlaybooks(owner, repo);

    res.json({ project, contributors });
  } catch (error) {
    console.error('Error fetching playbook:', error.message);
    next(error);
  }
});

export default router;
