import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import knexInit from 'knex';
import cors from 'cors';
import projectRoutes from './routes/projects.js';
import tasksRoutes from './routes/tasks.js';
import projectStatsRoutes from './routes/projectStats.js';
import projectSessionsRoutes from './routes/projectSessions.js';
import queueRoutes from "./routes/queues.js";

import knexfile from '../knexfile.js';

const db = knexInit(knexfile.development);
console.log('DB Path used by server:', knexfile.development.connection.filename);
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Adjust for production
  }
});
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  req.db = db;
  req.io = io; // Make io available in routes
  next();
});

app.use('/api/projects', projectRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/project_stats', projectStatsRoutes);
app.use("/api/queues", queueRoutes);
app.use("/api/project_sessions", projectSessionsRoutes);

(async () => {
  try {
    await db.migrate.latest();
    console.log('Migrations applied');
    server.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to run migrations', err);
    process.exit(1);
  }
})();


