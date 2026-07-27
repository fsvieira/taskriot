import express from 'express';
import {
  getProjectSchedules,
  saveProjectSchedules,
} from '../controllers/projectSchedulesController.js';

const router = express.Router();

router.get('/projects/schedules', getProjectSchedules);
router.put('/projects/schedules', saveProjectSchedules);

export default router;