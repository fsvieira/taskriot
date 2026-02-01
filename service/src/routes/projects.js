import express from 'express';
import * as controller from '../controllers/projectsController.js';

const router = express.Router();

router.get('/', controller.getAllProjects);
router.post('/', controller.createProject);
router.put('/:id', controller.updateProject);
router.delete('/:id', controller.deleteProject);

router.get('/:id/emotional-indicators', controller.getEmotionalIndicators);
router.post('/:id/emotional-indicators', controller.saveEmotionalIndicators);

router.get('/:id/todo', controller.getTodoList);
router.get('/:id/todo', controller.getTodoList);

export default router;