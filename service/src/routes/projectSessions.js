import express from 'express';
import {
  createProjectSession,
  endProjectSession,
  getSessionsByProject,
} from '../controllers/projectSessionsController.js';

const router = express.Router();

router.post('/', createProjectSession);
router.patch('/:id/end', endProjectSession);
router.get('/:project_id', getSessionsByProject);


export default router;
