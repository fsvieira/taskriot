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
  ViewWeek,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek.js';
import ScheduleCard from '../components/ScheduleCard';

dayjs.extend(isoWeek);

const apiUrl = import.meta.env.VITE_API_URL;

const Planner = () => {
  const { t } = useTranslation();
  const [selectedDate, setSelectedDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [weekMode, setWeekMode] = useState(false);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPlanner = useCallback(async (date) => {
    try {
      const res = await fetch(`${apiUrl}/api/planner?date=${date}`);
      const data = await res.json();
      return data.entries || [];
    } catch (err) {
      console.error('Erro ao buscar planner:', err);
      return [];
    }
  }, []);

  const fetchPlannerForDate = useCallback(async (date) => {
    setLoading(true);
    const result = await fetchPlanner(date);
    setEntries(result);
    setLoading(false);
  }, [fetchPlanner]);

  const fetchPlannerForWeek = useCallback(async (startDate) => {
    setEntries([]);
    setLoading(true);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = dayjs(startDate).add(i, 'day').format('YYYY-MM-DD');
      const dayEntries = await fetchPlanner(date);
      if (dayEntries.length > 0) {
        days.push({ date, entries: dayEntries });
      }
    }
    setEntries(days);
    setLoading(false);
  }, [fetchPlanner]);

  useEffect(() => {
    if (weekMode) {
      fetchPlannerForWeek(selectedDate);
    } else {
      fetchPlannerForDate(selectedDate);
    }
  }, [selectedDate, weekMode, fetchPlannerForDate, fetchPlannerForWeek]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (weekMode) {
        fetchPlannerForWeek(selectedDate);
      } else {
        fetchPlannerForDate(selectedDate);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedDate, weekMode, fetchPlannerForDate, fetchPlannerForWeek]);

  const goToToday = () => {
    setSelectedDate(dayjs().format('YYYY-MM-DD'));
    setWeekMode(false);
  };

  const goToPrev = () => {
    if (weekMode) {
      setSelectedDate(dayjs(selectedDate).subtract(7, 'day').format('YYYY-MM-DD'));
    } else {
      setSelectedDate(dayjs(selectedDate).subtract(1, 'day').format('YYYY-MM-DD'));
    }
  };

  const goToNext = () => {
    if (weekMode) {
      setSelectedDate(dayjs(selectedDate).add(7, 'day').format('YYYY-MM-DD'));
    } else {
      setSelectedDate(dayjs(selectedDate).add(1, 'day').format('YYYY-MM-DD'));
    }
  };

  const toggleWeekMode = () => {
    setWeekMode(!weekMode);
    if (!weekMode) {
      // When entering week mode, start from today
      setSelectedDate(dayjs().format('YYYY-MM-DD'));
    }
  };

  const handleComplete = async (entry, newDoneState) => {
    try {
      const taskId = entry.do_task ? entry.do_task.id : entry.task_id;
      const isRecurring = entry.do_task ? entry.do_task.is_recurring : entry.is_recurring;

      if (isRecurring && newDoneState) {
        await fetch(`${apiUrl}/api/tasks/${taskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ increment_counter: true }),
        });
      } else {
        await fetch(`${apiUrl}/api/tasks/${taskId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed: newDoneState }),
        });
      }
      // Refresh
      if (weekMode) {
        fetchPlannerForWeek(selectedDate);
      } else {
        fetchPlannerForDate(selectedDate);
      }
    } catch (err) {
      console.error('Erro ao completar tarefa:', err);
    }
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

  const formatDateFull = (dateStr) => {
    const d = dayjs(dateStr);
    const today = dayjs();
    if (d.isSame(today, 'day')) return t('pages.planner.today');
    return d.format('dddd, DD/MM/YYYY');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'success.main';
      case 'recent': return 'warning.main';
      case 'upcoming': return 'info.main';
      default: return 'grey.500';
    }
  };

  const getWeekRangeLabel = () => {
    const start = dayjs(selectedDate);
    const end = start.add(6, 'day');
    return `${start.format('DD/MM')} - ${end.format('DD/MM/YYYY')}`;
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mt: 2, mb: 2 }}>
        {t('pages.planner.title')}
      </Typography>

      {/* Date Navigation */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={goToPrev} size="small">
          <ChevronLeft />
        </IconButton>
        <Typography variant="h6" sx={{ minWidth: 200, textAlign: 'center' }}>
          {weekMode ? getWeekRangeLabel() : formatDate(selectedDate)}
        </Typography>
        <IconButton onClick={goToNext} size="small">
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
        <Button
          variant={weekMode ? 'contained' : 'outlined'}
          size="small"
          startIcon={<ViewWeek />}
          onClick={toggleWeekMode}
        >
          {t('pages.planner.week')}
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
      {!loading && (
        <>
          {weekMode ? (
            Array.isArray(entries) && entries.length > 0 && 'entries' in entries[0] ? (
              <Stack spacing={3}>
                {entries.map((day) => (
                  <Box key={day.date}>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 'bold',
                        color: 'text.secondary',
                        mb: 1,
                        pb: 0.5,
                        borderBottom: '2px solid',
                        borderColor: 'divider',
                      }}
                    >
                      {formatDateFull(day.date)}
                    </Typography>
                    <Stack spacing={2}>
                      {day.entries.map((entry) => (
                        <ScheduleCard
                          key={`${entry.schedule_id}-${entry.task_id}`}
                          entry={entry}
                          onComplete={(done) => handleComplete(entry, done)}
                          statusColor={getStatusColor(entry.status)}
                        />
                      ))}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            ) : (
              <Typography color="text.secondary" sx={{ mt: 4, textAlign: 'center' }}>
                {t('pages.planner.noScheduledTasks')}
              </Typography>
            )
          ) : (
            entries.length === 0 ? (
              <Typography color="text.secondary" sx={{ mt: 4, textAlign: 'center' }}>
                {t('pages.planner.noScheduledTasks')}
              </Typography>
            ) : (
              <Stack spacing={2}>
                {entries.map((entry) => (
                  <ScheduleCard
                    key={`${entry.schedule_id}-${entry.task_id}`}
                    entry={entry}
                    onComplete={(done) => handleComplete(entry, done)}
                    statusColor={getStatusColor(entry.status)}
                  />
                ))}
              </Stack>
            )
          )}
        </>
      )}
    </Box>
  );
};

export default Planner;