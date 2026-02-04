import React, { useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  Checkbox,
  Box,
  Divider,
  IconButton,
  LinearProgress,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import BarChartIcon from "@mui/icons-material/BarChart";
import SentimentSatisfiedAltIcon from "@mui/icons-material/SentimentSatisfiedAlt";
import MoodBadIcon from '@mui/icons-material/MoodBad';
import SentimentSatisfiedIcon from '@mui/icons-material/SentimentSatisfied';
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import CloseIcon from "@mui/icons-material/Close";
import { observer } from "mobx-react-lite";
import { projectStore } from "../../stores/ProjectStore";
import TaskTreeModal from "./TaskTreeModal";
import EmotionalIndicatorsModal from "../EmotionalIndicatorsModal";

const getEmotionalIcon = (average) => {

  switch (average) {
    case 1: return { icon: MoodBadIcon, color: 'error' };
    case 2: return { icon: SentimentSatisfiedIcon, color: 'warning' };
    case 3: return { icon: SentimentSatisfiedAltIcon, color: 'success' };
    default: return { icon: SentimentSatisfiedIcon, color: 'warning' };
  }
};

const TodoItem = observer(({ project, task, path, refreshTaskFocus }) => {
  const [checked, setChecked] = useState(Boolean(task.completed));
  const [taskTreeOpen, setTaskTreeOpen] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showEmotionalModal, setShowEmotionalModal] = useState(false);

  const timerState = projectStore.getTimerStateForProject(project.id);
  const { timeLeft, originalDuration, paused } = timerState;
  const elapsedMs = originalDuration - timeLeft;
  const timerPercentage = originalDuration > 0 ? (elapsedMs / originalDuration) * 100 : 0;

  const formatMsToHHMMSS = (ms) => {
    if (ms < 0) ms = 0;
    const seconds = Math.round(ms / 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const getGradientColor = (perc, opacity = 1) => {
    if (!perc) return `hsla(120, 50%, 70%, ${opacity})`;
    const hue = 120 * (perc / 100);
    return `hsla(${hue}, 50%, 70%, ${opacity})`;
  };

  const genProgressStats = () => {
    const stats = [
      { label: "Global", value: project.tasks?.percent_closed ?? 0 },
      { label: "Dia", value: project.tasks?.by_period?.today?.percent_closed ?? 0 },
      { label: "Semana", value: project.tasks?.by_period?.week?.percent_closed ?? 0 },
      { label: "Mês", value: project.tasks?.by_period?.month?.percent_closed ?? 0 },
    ];

    return (
      <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
        {stats.map(({ label, value }) => (
          <Box key={label} sx={{ minWidth: 90 }}>
            <Typography variant="body2" sx={{ fontWeight: "bold", mb: 0.5 }}>
              {label}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={value}
              sx={{
                height: 10,
                borderRadius: 4,
                backgroundColor: "#eee",
                "& .MuiLinearProgress-bar": { backgroundColor: getGradientColor(value) },
              }}
            />
            <Typography variant="caption" sx={{ display: "block", textAlign: "center", mt: 0.5 }}>
              {value}%
            </Typography>
          </Box>
        ))}
      </Box>
    );
  };

  const getTaskStats = (period) => ({
    open: project.tasks?.by_period?.[period]?.open ?? 0,
    closed: project.tasks?.by_period?.[period]?.closed ?? 0,
    percent: project.tasks?.by_period?.[period]?.percent_closed ?? 0,
  });

  const getTimeStats = (period) => {
    if (period === "today") return project.timeToday || 0;
    if (period === "week") return project.timeThisWeek || 0;
    if (period === "month") return project.timeThisMonth || 0;
    if (period === "global") return project.timeTotal || 0;
    return 0;
  };

  const formatHumanTime = (hours) => {
    if (!hours || hours <= 0) return "0m";
    const totalMinutes = Math.round(hours * 60);
    const d = Math.floor(totalMinutes / 1440);
    const h = Math.floor((totalMinutes % 1440) / 60);
    const m = totalMinutes % 60;
    return [
      d > 0 ? `${d}d` : null,
      h > 0 ? `${h}h` : null,
      m > 0 ? `${m}m` : null,
    ].filter(Boolean).join(" ");
  };

  const getAvgTimePerClosed = (period) => {
    const closed = getTaskStats(period).closed;
    const hours = getTimeStats(period);
    return closed > 0 ? formatHumanTime(hours / closed) : "-";
  };

  const getAvgTimePerClosedGlobal = () => {
    const closed = project.tasks?.total_closed || 0;
    const hours = project.timeTotal || 0;
    return closed > 0 ? formatHumanTime(hours / closed) : "-";
  };

  const genStatsTable = () => {
    const periods = [
      { label: "Global", key: "global" },
      { label: "Dia", key: "today" },
      { label: "Semana", key: "week" },
      { label: "Mês", key: "month" },
    ];

    return (
      <Box sx={{ mt: 2, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: "bold" }}>
          Estatísticas
        </Typography>
        <Box component="table" sx={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th></th>
              {periods.map(p => (
                <th key={p.key} style={{ textAlign: "center", fontWeight: "bold" }}>{p.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Tarefas abertas</td>
              {periods.map(p =>
                <td key={p.key} style={{ textAlign: "center" }}>
                  {p.key === "global"
                    ? project.tasks?.total_open ?? 0
                    : getTaskStats(p.key).open}
                </td>
              )}
            </tr>
            <tr>
              <td>Tarefas fechadas</td>
              {periods.map(p =>
                <td key={p.key} style={{ textAlign: "center" }}>
                  {p.key === "global"
                    ? project.tasks?.total_closed ?? 0
                    : getTaskStats(p.key).closed}
                </td>
              )}
            </tr>
            <tr>
              <td>Tempo gasto</td>
              {periods.map(p =>
                <td key={p.key} style={{ textAlign: "center" }}>
                  {formatHumanTime(getTimeStats(p.key))}
                </td>
              )}
            </tr>
            <tr>
              <td>Tempo médio por tarefa fechada</td>
              {periods.map(p =>
                <td key={p.key} style={{ textAlign: "center" }}>
                  {p.key === "global"
                    ? getAvgTimePerClosedGlobal()
                    : getAvgTimePerClosed(p.key)}
                </td>
              )}
            </tr>
          </tbody>
        </Box>
      </Box>
    );
  };

  const handleTimerToggle = () => {
    const duration4h = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
    // Use toggleTimer to avoid reordering/fetching queues from Task Focus
    projectStore.toggleTimer(project.id, duration4h);
  };

  const handleOpenTaskTree = () => {
    setTaskTreeOpen(true);
  };

  const handleCloseTaskTree = async () => {
    setTaskTreeOpen(false);
    // Refresh the entire Task Focus queue when closing the task tree dialog
    if (refreshTaskFocus) {
      await refreshTaskFocus();
    }
  };

  const handleToggleDone = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL;
      const response = await fetch(`${baseUrl}/api/tasks/${task.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !checked }),
      });

      if (response.ok) {
        setChecked(!checked);

        // Busca a nova árvore de tarefas para este projeto (novo TODO leaf)
        await projectStore.fetchProjectTasks(project.id);

        // Refresh the entire Task Focus queue after completing a task
        if (refreshTaskFocus) {
          await refreshTaskFocus();
        }
      } else {
        console.error("Erro ao marcar tarefa como feita");
      }
    } catch (err) {
      console.error("Erro ao marcar tarefa como feita:", err);
    }
  };

  const emotionalAverage = project.emotional_average ?? 2;
  const { icon: Icon, color } = getEmotionalIcon(emotionalAverage);


  return (
    <Card
      sx={{
        width: "100%",
        mb: 2,
        border: "1px solid #ccc",
        borderRadius: 2,
        boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
        backgroundColor: !paused ? getGradientColor(100 - timerPercentage, 0.3) : "#f9f9f9",
      }}
    >
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Checkbox
            checked={checked}
            onChange={handleToggleDone}
            sx={{ flexShrink: 0 }}
          />
          <Box sx={{ flexGrow: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
                {project.name}
              </Typography>
              <IconButton
                onClick={handleOpenTaskTree}
                size="small"
                sx={{
                  color: "primary.main",
                  backgroundColor: "rgba(25, 118, 210, 0.1)",
                  "&:hover": {
                    backgroundColor: "rgba(25, 118, 210, 0.2)",
                  }
                }}
                title="Abrir árvore de tarefas"
              >
                <AccountTreeIcon fontSize="small" />
              </IconButton>
              <IconButton
                onClick={() => setShowStats(true)}
                size="small"
                sx={{
                  color: "primary.main",
                  backgroundColor: "rgba(25, 118, 210, 0.1)",
                  "&:hover": {
                    backgroundColor: "rgba(25, 118, 210, 0.2)",
                  }
                }}
                title="Ver estatísticas"
              >
                <BarChartIcon fontSize="small" />
              </IconButton>
              <IconButton
                onClick={() => setShowEmotionalModal(true)}
                size="small"
                sx={{
                  color: 'white',
                  backgroundColor: (theme) => theme.palette[color]?.main || theme.palette.grey[500],
                  '&:hover': {
                    backgroundColor: (theme) => theme.palette[color]?.dark || theme.palette.grey[700],
                  },
                }}
                title="Indicadores Emocionais"
              >
                <Icon fontSize="small" />
              </IconButton>
            </Box>
            {path && (
              <>
                <Typography
                  variant="body2"
                  sx={{
                    color: "text.secondary",
                    fontSize: "0.875rem",
                    mb: 1,
                  }}
                >
                  {path}
                </Typography>
                <Divider sx={{ mb: 1 }} />
              </>
            )}
            <Typography
              variant="body1"
              sx={{
                textDecoration: checked ? "line-through" : "none",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {task.title}
            </Typography>
          </Box>
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
      </CardContent>

      <Dialog
        open={showStats}
        onClose={() => setShowStats(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Estatísticas - {project.name}
          <IconButton
            onClick={() => setShowStats(false)}
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
        <DialogContent>
          {genProgressStats()}
          {genStatsTable()}
        </DialogContent>
      </Dialog>

      <TaskTreeModal
        open={taskTreeOpen}
        onClose={handleCloseTaskTree}
        project={project}
        title="Árvore de Tarefas"
      />

      <EmotionalIndicatorsModal
        open={showEmotionalModal}
        onClose={() => setShowEmotionalModal(false)}
        project={project}
        onSave={() => {
          if (refreshTaskFocus) {
            refreshTaskFocus();
          }
        }}
      />
    </Card>
  );
});

export default TodoItem;