// routes/projectStatsRoutes.js
import express from 'express';
import * as controller from '../controllers/projectStatsController.js';

const router = express.Router();

router.get('/', controller.getProjectStats);
router.get('/kpis', controller.getKpis);
router.get('/daily-time', controller.getDailyTimeStats);
router.get('/habits', controller.getHabitsStats);
router.get('/completed-tasks', controller.getCompletedTasksStats);
router.get('/time-by-project', controller.getTimeByProjectStats);
router.get('/open-closed-weekly', controller.getOpenClosedWeekly);
router.get('/project-stability', controller.getProjectStability);
router.get('/task-incidence-by-time', controller.getTaskIncidenceByTime);

export default router;
