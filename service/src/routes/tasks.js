import express from 'express';
import {
  createTask,
  getTaskWithChildren,
  getAllRecurringTasks,
  updateHabitsProjectsOrder,
  updateHabitsTasksOrder,
  deleteTaskRecursively,
  updateTask,
  closeTaskRecursively
} from '../controllers/tasksController.js';

const router = express.Router();

router.get('/habits', getAllRecurringTasks);
router.put('/habits/projects-order', updateHabitsProjectsOrder);
router.put('/habits/:projectId/tasks-order', updateHabitsTasksOrder);
router.delete('/:taskId', deleteTaskRecursively);
router.post('/', createTask);
router.get('/project/:projectId/:taskId?', getTaskWithChildren);
router.put('/:taskId', updateTask);
router.put('/:taskId/close-recursive', closeTaskRecursively);

export default router;
