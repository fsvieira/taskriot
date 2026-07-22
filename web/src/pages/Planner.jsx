import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  IconButton,
  LinearProgress,
  Button,
  Stack,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Today,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import ScheduleCard from '../components/ScheduleCard';

const apiUrl = import.meta.env.VITE_API_URL;

const Planner = () => {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPlanner = useCallback(async (date) => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/planner?date=${date}`);
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (err) {
      console.error('Erro ao buscar planner:', err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlanner(selectedDate);
  }, [selectedDate, fetchPlanner]);

  // Auto-refresh every 30 seconds to update statuses
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPlanner(selectedDate);
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedDate, fetchPlanner]);

  const goToToday = () => setSelectedDate(dayjs().format('YYYY-MM-DD'));
  const goToPrevDay = () => setSelectedDate(dayjs(selectedDate).subtract(1, 'day').format('YYYY-MM-DD'));
  const goToNextDay = () => setSelectedDate(dayjs(selectedDate).add(1, 'day').format('YYYY-MM-DD'));

  const handleComplete = async (entry) => {
    try {
      if (entry.do_task && !entry.do_task.completed) {
        const taskId = entry.do_task.id;
        if (entry.do_task.is_recurring) {
          // Increment counter for recurring
          await fetch(`${apiUrl}/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ increment_counter: true }),
          });
        } else {
          // Complete non-recurring
          await fetch(`${apiUrl}/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: true }),
          });
        }
        // Refresh planner
        fetchPlanner(selectedDate);
      }
    } catch (err) {
      console.error('Erro ao completar tarefa:', err);
    }
  };

  const handleNextTask = async (entry) => {
    // For now, this just refreshes - the backend will recalculate the leftmost leaf
    // and if the current do_task was completed, it should show the next one
    // If the do_task has no open siblings, the entry may disappear
    fetchPlanner(selectedDate);
  };

  const formatDate = (dateStr) => {
    const d = dayjs(dateStr);
    const today = dayjs();
    const tomorrow = today.add(1, 'day');
    const yesterday = today.subtract(1, 'day');

    if (d.isSame(today, 'day')) return t('pages.planner.today');
    if (d.isSame(tomorrow, 'day')) return t('pages.planner.tomorrow');
    if (d.isSame(yesterday, 'day')) return t('pages.planner.yesterday');

    return d.format('DD/MM/YYYY');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success.main';
      case 'recent': return 'warning.main';
      case 'upcoming': return 'info.main';
      default: return 'grey.500';
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mt: 2, mb: 2 }}>
        {t('pages.planner.title')}
      </Typography>

      {/* Date Navigation */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={goToPrevDay} size="small">
          <ChevronLeft />
        </IconButton>
        <Typography variant="h6" sx={{ minWidth: 200, textAlign: 'center' }}>
          {formatDate(selectedDate)}
        </Typography>
        <IconButton onClick={goToNextDay} size="small">
          <ChevronRight />
        </IconButton>
        <Button
          variant="outlined"
          size="small"
          startIcon={<Today />}
          onClick={goToToday}
          sx={{ ml: 2 }}
        >
          {t('pages.planner.today')}
        </Button>
      </Box>

      {/* Loading */}
      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Status Legend */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'success.main' }} />
          <Typography variant="caption">{t('pages.planner.active')}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'warning.main' }} />
          <Typography variant="caption">{t('pages.planner.recent')}</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: 'info.main' }} />
          <Typography variant="caption">{t('pages.planner.upcoming')}</Typography>
        </Box>
      </Box>

      {/* Entries List */}
      {!loading && entries.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 4, textAlign: 'center' }}>
          {t('pages.planner.noScheduledTasks')}
        </Typography>
      ) : (
        <Stack spacing={2}>
          {entries.map((entry) => (
            <ScheduleCard
              key={`${entry.schedule_id}-${entry.task_id}`}
              entry={entry}
              onComplete={() => handleComplete(entry)}
              onNextTask={() => handleNextTask(entry)}
              statusColor={getStatusColor(entry.status)}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default Planner;