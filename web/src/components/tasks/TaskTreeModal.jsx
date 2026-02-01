import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  LinearProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { observer } from 'mobx-react-lite';
import { projectStore } from '../../stores/ProjectStore';
import TaskTree from './TaskTree';

const TaskTreeModal = observer(({ open, onClose, project, title }) => {
  const timerState = projectStore.getTimerStateForProject(project.id);
  const { timeLeft, originalDuration, paused } = timerState;
  const elapsedMs = originalDuration - timeLeft;

  const formatMsToHMS = (ms) => {
    if (ms < 0) ms = 0;
    const seconds = Math.round(ms / 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const timerPercentage = originalDuration > 0 ? (elapsedMs / originalDuration) * 100 : 0;

  const showTimer = timerState.activeProjectId === project.id && !paused;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: '100vw',
          height: '100vh',
          m: 0,
          borderRadius: 0,
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle sx={{ px: 3, py: 2 }}>
        {project.name} - {title}
        <IconButton
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: 'grey.500',
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          px: 4,
          py: 2,
          backgroundColor: '#fdfdfd',
        }}
      >
        {showTimer && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mb: 2,
              p: 2,
              backgroundColor: 'white',
              borderRadius: 1,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <Typography
              variant="body2"
              sx={{
                minWidth: 110,
                whiteSpace: "nowrap",
                fontWeight: "bold",
                fontSize: '1.2rem',
                backgroundColor: 'white',
                color: 'black',
                padding: '2px 4px'
              }}
            >
              {formatMsToHMS(elapsedMs)} / {formatMsToHMS(originalDuration)}
            </Typography>

            <LinearProgress
              variant="determinate"
              value={timerPercentage}
              sx={{
                flexGrow: 1,
                height: 8,
                borderRadius: 4,
                backgroundColor: "#ddd",
                "& .MuiLinearProgress-bar": { backgroundColor: "#007acc" },
              }}
            />
          </Box>
        )}

        <TaskTree project={project} />
      </DialogContent>
    </Dialog>
  );
});

export default TaskTreeModal;