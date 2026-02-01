import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Button,
  Paper,
  Divider,
  IconButton,
  Stack,
} from '@mui/material';
import { DragIndicator } from '@mui/icons-material';
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import { observer } from "mobx-react-lite";
import { projectStore } from "../stores/ProjectStore";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const apiUrl = import.meta.env.VITE_API_URL;

const getTaskColor = (perc) => {
  if (perc == null) return "#e3f2fd";
  const hue = 120 * (perc / 100);
  return `hsl(${hue}, 50%, 70%)`;
};

const getGradientColor = (perc) => {
  if (!perc) return "hsla(120, 50%, 70%, 0.3)";
  const hue = 120 * (perc / 100);
  return `hsla(${hue}, 50%, 70%, 0.3)`;
};

// Sortable Task Row (only "active" tasks are sortable)
function SortableTaskRow({ task, onIncrement }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `task-${task.id}` });

  const isDone = (task.current_counter ?? 0) >= (task.objective ?? 0);

  return (
    <ListItem
      ref={setNodeRef}
      sx={{
        bgcolor: getTaskColor(task.percent_closed),
        borderRadius: 1,
        mb: 1,
        display: 'flex',
        alignItems: 'center',
        opacity: isDragging ? 0.6 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      secondaryAction={
        <IconButton
          size="small"
          title="Arrastar tarefa"
          {...attributes}
          {...listeners}
          sx={{ cursor: 'grab' }}
        >
          <DragIndicator />
        </IconButton>
      }
    >
      <Button
        variant="contained"
        size="small"
        onClick={() => onIncrement(task.id)}
        sx={{ mr: 2, minWidth: 60 }}
      >
        {task.current_counter} / {task.objective}
      </Button>
      <ListItemText
        primary={task.title}
        sx={{
          textDecoration: isDone ? 'line-through' : 'none',
        }}
      />
    </ListItem>
  );
}

// Not-sortable row for "done" tasks (always pinned to bottom in UI only)
function DoneTaskRow({ task, onIncrement }) {
  const isDone = (task.current_counter ?? 0) >= (task.objective ?? 0);

  return (
    <ListItem
      sx={{
        bgcolor: getTaskColor(task.percent_closed),
        borderRadius: 1,
        mb: 1,
        display: 'flex',
        alignItems: 'center',
        opacity: 1,
      }}
      secondaryAction={null}
    >
      <Button
        variant="contained"
        size="small"
        onClick={() => onIncrement(task.id)}
        sx={{ mr: 2, minWidth: 60 }}
      >
        {task.current_counter} / {task.objective}
      </Button>
      <ListItemText
        primary={task.title}
        sx={{
          textDecoration: isDone ? 'line-through' : 'none',
        }}
      />
    </ListItem>
  );
}

// Sortable Project Panel wrapper
const SortableProjectPanel = observer(({ project, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `proj-${project.id}` });

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

  const handleTimerToggle = () => {
    const duration4h = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
    projectStore.toggleTimer(project.id, duration4h);
  };

  return (
    <Paper
      ref={setNodeRef}
      sx={{
        mb: 2,
        p: 2,
        opacity: isDragging ? 0.7 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
        backgroundColor: !paused ? getGradientColor(100 - timerPercentage) : undefined,
      }}
      elevation={2}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <IconButton
          size="small"
          title="Arrastar projeto"
          {...attributes}
          {...listeners}
          sx={{ cursor: 'grab' }}
        >
          <DragIndicator />
        </IconButton>
        <Typography variant="h6" sx={{ flex: 1 }}>
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
      </Stack>
      <Divider sx={{ mb: 1 }} />
      {children}
    </Paper>
  );
});

export default function HabitsWidget() {
  const { t } = useTranslation();
  const [projects, setProjects] = useState([]); // [{id, name, habits_order, tasks: [...] }]

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const fetchHabits = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/tasks/habits`);
      const data = await res.json();
      // Expecting { projects: [...] } already sorted by backend habits_order
      setProjects(data.projects || []);
    } catch (err) {
      console.error('Erro ao buscar hábitos:', err);
    }
  }, []);

  useEffect(() => {
    fetchHabits();
  }, [fetchHabits]);

  const incrementCounter = async (taskId) => {
    try {
      const response = await fetch(`${apiUrl}/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ increment_counter: true }),
      });
      if (!response.ok) {
        console.error('Falha ao incrementar contador');
        return;
      }
      // Refetch to reflect changes (some tasks may move to "done" UI section)
      await fetchHabits();
    } catch (err) {
      console.error('Erro ao incrementar contador:', err);
    }
  };

  // Persist project order
  const persistProjectsOrder = async (projArray) => {
    try {
      const projectIds = projArray.map((p) => p.id);
      const resp = await fetch(`${apiUrl}/api/tasks/habits/projects-order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectIds }),
      });
      if (!resp.ok) {
        console.error('Falha ao persistir ordem de projetos');
      }
    } catch (err) {
      console.error('Erro ao persistir ordem de projetos:', err);
    }
  };

  // Persist tasks order (only "active" tasks sent to backend; "done" pin is UI-only)
  const persistTasksOrder = async (projectId, activeTasks) => {
    try {
      const taskIds = activeTasks.map((t) => t.id);
      const resp = await fetch(`${apiUrl}/api/tasks/habits/${projectId}/tasks-order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds }),
      });
      if (!resp.ok) {
        console.error('Falha ao persistir ordem de tarefas');
      }
    } catch (err) {
      console.error('Erro ao persistir ordem de tarefas:', err);
    }
  };

  // Drag end for projects
  const handleProjectsDragEnd = (event) => {
    const { active, over } = event || {};
    if (!active || !over || active.id === over.id) return;

    const ids = projects.map((p) => `proj-${p.id}`);
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

    const newProjects = arrayMove(projects, oldIndex, newIndex);
    setProjects(newProjects);
    persistProjectsOrder(newProjects);
  };

  // Drag end for tasks within a specific project (only active tasks are sortable)
  const makeHandleTasksDragEnd = (project) => (event) => {
    const { active, over } = event || {};
    if (!active || !over || active.id === over.id) return;

    // Split tasks: active (not done) and done
    const allTasks = project.tasks || [];
    const activeTasks = allTasks.filter((t) => (t.current_counter ?? 0) < (t.objective ?? 0));
    const doneTasks = allTasks.filter((t) => (t.current_counter ?? 0) >= (t.objective ?? 0));

    const ids = activeTasks.map((t) => `task-${t.id}`);
    const oldIndex = ids.indexOf(active.id);
    const newIndex = ids.indexOf(over.id);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

    const newActiveTasks = arrayMove(activeTasks, oldIndex, newIndex);

    // Update state: replace tasks for this project with new active order followed by done (UI-only pin)
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== project.id) return p;
        return { ...p, tasks: [...newActiveTasks, ...doneTasks] };
      })
    );

    // Persist only the active order (done pin is NOT persisted)
    persistTasksOrder(project.id, newActiveTasks);
  };

  return (
    <Box sx={{ mt: 2 }}>
      {projects.length === 0 && (
        <Typography>{t('pages.habits.noHabits')}</Typography>
      )}
      {/* Projects drag-and-drop */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleProjectsDragEnd}>
        <SortableContext
          items={projects.map((p) => `proj-${p.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {projects.map((project) => {
            // Split tasks per UI rule: done to bottom (UI-only)
            const allTasks = project.tasks || [];
            const activeTasks = allTasks.filter((t) => (t.current_counter ?? 0) < (t.objective ?? 0));
            const doneTasks = allTasks.filter((t) => (t.current_counter ?? 0) >= (t.objective ?? 0));

            return (
              <SortableProjectPanel key={project.id} project={project}>
                {/* Per-project tasks drag-and-drop (active tasks only) */}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={makeHandleTasksDragEnd(project)}
                >
                  <SortableContext
                    items={activeTasks.map((t) => `task-${t.id}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    <List sx={{ pb: 0 }}>
                      {activeTasks.map((task) => (
                        <SortableTaskRow key={task.id} task={task} onIncrement={incrementCounter} />
                      ))}
                    </List>
                  </SortableContext>
                </DndContext>

                {/* Done tasks (not sortable, always at bottom in UI) */}
                {doneTasks.length > 0 && (
                  <>
                    {activeTasks.length > 0 && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, mb: 0.5, display: 'block' }}>
                        Concluídas (pinned no fim - apenas UI)
                      </Typography>
                    )}
                    <List sx={{ pt: 0 }}>
                      {doneTasks.map((task) => (
                        <DoneTaskRow key={task.id} task={task} onIncrement={incrementCounter} />
                      ))}
                    </List>
                  </>
                )}
              </SortableProjectPanel>
            );
          })}
        </SortableContext>
      </DndContext>
    </Box>
  );
}