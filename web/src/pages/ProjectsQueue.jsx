import React, { useEffect, useState, useCallback } from "react";
import { useTranslation } from 'react-i18next';
import { Box, Typography, Tabs, Tab } from "@mui/material";
import { observer } from "mobx-react-lite";
import { projectStore } from "../stores/ProjectStore";
import TodoItem from "../components/tasks/TodoItem";
import HabitsWidget from "../components/HabitsWidget";
import Planner from "../pages/Planner";
import TaskTimelineChart from "../components/TaskTimelineChart";
import dayjs from 'dayjs';
import io from "socket.io-client";

const TodoListContent = observer(({ refreshTaskFocus }) => {
  const { t } = useTranslation();
  const todoItems = projectStore.getTodoItems();

  // Only show empty message if we have projects but no todo items
  const hasProjects = projectStore.queue.length > 0;
  const showEmptyMessage = hasProjects && (!todoItems || todoItems.length === 0);

  const hasTodos = todoItems && todoItems.length > 0;

  return (
    <>
      {hasTodos && todoItems.map(({ project, task, path }) => (
        <TodoItem key={`${project.id}-${task.id}`} project={project} task={task} path={path} refreshTaskFocus={refreshTaskFocus} />
      ))}

      {!hasTodos && showEmptyMessage && (
        <Typography>{t('pages.queue.noPendingTasks')}</Typography>
      )}
    </>
  );
});

const ProjectsQueue = observer(() => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);

  const refreshTaskFocus = useCallback(async () => {
    // Refresh TODO queue order from server (skip bringing active project to front)
    await projectStore.fetchQueue('todo', true);

    // Always fetch fresh task trees for visible projects
    const queue = projectStore.queue || [];
    for (const project of queue) {
      await projectStore.fetchProjectTasks(project.id);
    }
  }, []);

  useEffect(() => {
    projectStore.fetchProjects().then(() => {
      projectStore.fetchQueue(projectStore.currentQueueName, true);
    });

    const socket = io(import.meta.env.VITE_API_URL);
    socket.on('stats-update', () => {
      // Only refresh projects on stats updates to avoid unnecessary queue resets
      projectStore.fetchProjects();
    });

    socket.on('queue-update', (data) => {
      if (data.queue_name === projectStore.currentQueueName) {
        projectStore.fetchQueue(projectStore.currentQueueName, true);
      }
    });

    // Auto-refresh queue every 60 seconds to keep potential percentages updated
    const refreshInterval = setInterval(() => {
      projectStore.fetchQueue(projectStore.currentQueueName, true);
    }, 60000);

    return () => {
      socket.disconnect();
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, []);

  // Refresh TODO queue and fetch task trees when switching to Task Focus tab
  useEffect(() => {
    if (activeTab === 0) {
      refreshTaskFocus();
    }
  }, [activeTab, refreshTaskFocus]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    if (newValue === 0) {
      projectStore.switchQueue("todo");
    }
    // For tab 1 (habits) and tab 2 (planner), no queue switch needed
  };


  return (
    <Box sx={{ width: "100%", maxWidth: 1000, mx: "auto", p: 2 }}>
      <TaskTimelineChart />
      <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 2 }}>
        <Tab label={t('pages.queue.taskFocus')} />
        <Tab label={t('navigation.habits')} />
        <Tab label={t('navigation.planner')} />
      </Tabs>

      {activeTab === 0 && (
        <TodoListContent refreshTaskFocus={refreshTaskFocus} />
      )}

      {activeTab === 1 && (
        <HabitsWidget />
      )}

      {activeTab === 2 && (
        <Planner />
      )}
    </Box>
  );
});

export default ProjectsQueue;
