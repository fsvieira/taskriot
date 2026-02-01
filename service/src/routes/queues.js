import express from "express";
import {
  listQueues,
  createQueue,
  updateQueue,
  deleteQueue,
  getQueueProjects,
  reorderQueue
} from "../controllers/queueController.js";

const router = express.Router();

router.get("/", listQueues);
router.get("/:name/projects", getQueueProjects);
router.post("/:name/reorder", reorderQueue);
router.post("/", createQueue);
router.put("/:id", updateQueue);
router.delete("/:id", deleteQueue);

export default router;
