import React from 'react';
import { Paper, Typography, List, Box, IconButton } from '@mui/material';
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import { observer } from "mobx-react-lite";
import { projectStore } from "../stores/ProjectStore";
import HabitItem from './HabitItem';

const HabitProjectPanel = observer(({ project, onIncrement }) => {
  const timerState = projectStore.getTimerStateForProject(project.id);
  const { timeLeft, originalDuration, paused } = timerState;
  const elapsedMs = originalDuration - timeLeft;

  const formatMsToHHMMSS = (ms) => {
    if (ms < 0) ms = 0;
    const seconds = Math.round(ms / 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const handleTimerToggle = () => {
    const duration4h = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
    projectStore.toggleTimer(project.id, duration4h);
  };

  return (
    <Paper elevation={2} sx={{ mb: 2, p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="h6">
          {project.name}
        </Typography>
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
          <Typography
            variant="body2"
            sx={{
              minWidth: 110,
              whiteSpace: "nowrap",
              color: '#0000FF',
              textShadow: `
                0 0 1px #00FFFF,
                0 0 2px #00FFFF,
                0 0 3px #00FFFF,
                0 0 5px #00FFFF
              `,
              opacity: 0.6,
              fontSize: '1.3rem',
              padding: '2px 4px'
            }}
          >
            {formatMsToHHMMSS(elapsedMs)}
          </Typography>
          <IconButton
            onClick={handleTimerToggle}
            sx={{ color: "white", backgroundColor: "success.main" }}
          >
            {!paused ? <PauseIcon /> : <PlayArrowIcon />}
          </IconButton>
        </Box>
      </Box>
      <List>
        {project.tasks.map(task => (
          <HabitItem key={task.id} task={task} onIncrement={onIncrement} />
        ))}
      </List>
    </Paper>
  );
});

export default HabitProjectPanel;