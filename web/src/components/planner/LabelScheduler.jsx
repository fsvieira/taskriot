import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Button,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { Add, Delete, Schedule } from '@mui/icons-material';

const apiUrl = import.meta.env.VITE_API_URL;

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// Generate 00-23 for hours
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
// Generate 00, 05, 10, ... 55 (5-minute intervals)
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

function formatTime(timeStr) {
  if (!timeStr) return '';
  return timeStr.slice(0, 5);
}

export default function LabelScheduler() {
  const [labels, setLabels] = useState([]);
  const [selectedLabelId, setSelectedLabelId] = useState('');
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schedulesLoading, setSchedulesLoading] = useState(false);

  // Form state for adding a new schedule
  const [selectedDays, setSelectedDays] = useState([]);
  const [startHour, setStartHour] = useState('09');
  const [startMin, setStartMin] = useState('00');
  const [endHour, setEndHour] = useState('10');
  const [endMin, setEndMin] = useState('00');

  const fetchLabels = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/labels`);
      const data = await res.json();
      setLabels(data);
      if (data.length > 0 && !selectedLabelId) {
        setSelectedLabelId(String(data[0].id));
      }
    } catch (err) {
      console.error('Erro ao buscar fases:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  const fetchSchedules = useCallback(async (labelId) => {
    if (!labelId) return;
    setSchedulesLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/labels/${labelId}/schedules`);
      const data = await res.json();
      setSchedules(data);
    } catch (err) {
      console.error('Erro ao buscar horários:', err);
    } finally {
      setSchedulesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedLabelId) {
      fetchSchedules(selectedLabelId);
    }
  }, [selectedLabelId, fetchSchedules]);

  const handleLabelChange = (e) => {
    setSelectedLabelId(e.target.value);
  };

  const toggleDay = (dayIndex) => {
    setSelectedDays(prev =>
      prev.includes(dayIndex)
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex]
    );
  };

  const resetForm = () => {
    setSelectedDays([]);
    setStartHour('09');
    setStartMin('00');
    setEndHour('10');
    setEndMin('00');
  };

  const handleAddSchedule = async () => {
    if (!selectedLabelId || selectedDays.length === 0) return;
    const startTime = `${startHour}:${startMin}:00`;
    const endTime = `${endHour}:${endMin}:00`;

    if (startTime >= endTime) return;

    try {
      for (const dayIndex of selectedDays) {
        await fetch(`${apiUrl}/api/labels/${selectedLabelId}/schedules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            day_of_week: dayIndex,
            start_time: startTime,
            end_time: endTime,
          }),
        });
      }
      resetForm();
      fetchSchedules(selectedLabelId);
    } catch (err) {
      console.error('Erro ao adicionar horário:', err);
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    try {
      await fetch(`${apiUrl}/api/label-schedules/${scheduleId}`, {
        method: 'DELETE',
      });
      fetchSchedules(selectedLabelId);
    } catch (err) {
      console.error('Erro ao apagar horário:', err);
    }
  };

  const getDayLabel = (dayOfWeek) => DAY_LABELS[dayOfWeek] || '?';

  if (loading) return <LinearProgress />;

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Calendarizar Fases
      </Typography>

      {/* Label selector */}
      <FormControl size="small" fullWidth sx={{ mb: 2 }}>
        <InputLabel>Fase</InputLabel>
        <Select
          value={selectedLabelId}
          onChange={handleLabelChange}
          label="Fase"
        >
          {labels.map((label) => (
            <MenuItem key={label.id} value={String(label.id)}>
              {label.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {!selectedLabelId ? (
        <Typography color="text.secondary" sx={{ mt: 4, textAlign: 'center' }}>
          Selecione uma fase para gerir a sua calendarização.
        </Typography>
      ) : (
        <>
          {/* Existing schedules */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Horários actuais:
            </Typography>
            {schedulesLoading ? (
              <LinearProgress />
            ) : schedules.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nenhum horário definido para esta fase.
              </Typography>
            ) : (
              <List dense>
                {schedules.map((sched) => (
                  <ListItem
                    key={sched.id}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      mb: 0.5,
                    }}
                    secondaryAction={
                      <IconButton
                        edge="end"
                        size="small"
                        color="error"
                        onClick={() => handleDeleteSchedule(sched.id)}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={`${DAY_NAMES[sched.day_of_week]} - ${formatTime(sched.start_time)} às ${formatTime(sched.end_time)}`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>

          {/* Add new schedule form */}
          <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Adicionar novo horário:
            </Typography>

            {/* Day selector */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                Dias da semana:
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {DAY_LABELS.map((label, index) => (
                  <Chip
                    key={index}
                    label={label}
                    size="small"
                    color={selectedDays.includes(index) ? 'primary' : 'default'}
                    onClick={() => toggleDay(index)}
                    variant={selectedDays.includes(index) ? 'filled' : 'outlined'}
                  />
                ))}
              </Box>
            </Box>

            {/* Time selector */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Typography variant="body2">De</Typography>
              <FormControl size="small" sx={{ minWidth: 70 }}>
                <InputLabel>Hora</InputLabel>
                <Select
                  value={startHour}
                  onChange={(e) => setStartHour(e.target.value)}
                  label="Hora"
                >
                  {HOURS.map(h => (
                    <MenuItem key={h} value={h}>{h}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="body2">:</Typography>
              <FormControl size="small" sx={{ minWidth: 70 }}>
                <InputLabel>Min</InputLabel>
                <Select
                  value={startMin}
                  onChange={(e) => setStartMin(e.target.value)}
                  label="Min"
                >
                  {MINUTES.map(m => (
                    <MenuItem key={m} value={m}>{m}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Typography variant="body2">até</Typography>
              <FormControl size="small" sx={{ minWidth: 70 }}>
                <InputLabel>Hora</InputLabel>
                <Select
                  value={endHour}
                  onChange={(e) => setEndHour(e.target.value)}
                  label="Hora"
                >
                  {HOURS.map(h => (
                    <MenuItem key={h} value={h}>{h}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="body2">:</Typography>
              <FormControl size="small" sx={{ minWidth: 70 }}>
                <InputLabel>Min</InputLabel>
                <Select
                  value={endMin}
                  onChange={(e) => setEndMin(e.target.value)}
                  label="Min"
                >
                  {MINUTES.map(m => (
                    <MenuItem key={m} value={m}>{m}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Button
              variant="contained"
              size="small"
              startIcon={<Schedule />}
              onClick={handleAddSchedule}
              disabled={
                selectedDays.length === 0 ||
                `${startHour}:${startMin}:00` >= `${endHour}:${endMin}:00`
              }
            >
              Adicionar Horário
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
}