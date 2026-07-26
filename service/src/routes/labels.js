import express from 'express';
import {
  getLabels,
  createLabel,
  updateLabel,
  deleteLabel,
  getLabelSchedules,
  createLabelSchedule,
  deleteLabelSchedule,
  getTaskLabels,
  setTaskLabels
} from '../controllers/labelsController.js';

const router = express.Router();

router.get('/labels', getLabels);
router.post('/labels', createLabel);
router.put('/labels/:id', updateLabel);
router.delete('/labels/:id', deleteLabel);

router.get('/labels/:labelId/schedules', getLabelSchedules);
router.post('/labels/:labelId/schedules', createLabelSchedule);
router.delete('/label-schedules/:scheduleId', deleteLabelSchedule);

router.get('/tasks/:taskId/labels', getTaskLabels);
router.put('/tasks/:taskId/labels', setTaskLabels);

export default router;
