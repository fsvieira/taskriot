import express from 'express';
import {
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getTaskSchedules
} from '../controllers/scheduleController.js';

const router = express.Router();

router.post('/tasks/:taskId/schedules', createSchedule);
router.put('/schedules/:scheduleId', updateSchedule);
router.delete('/schedules/:scheduleId', deleteSchedule);
router.get('/tasks/:taskId/schedules', getTaskSchedules);

export default router;