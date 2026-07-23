import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  TextField,
  Typography,
  FormControlLabel,
  Checkbox,
  IconButton,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from '@mui/material';
import { Add, Delete, Schedule } from '@mui/icons-material';

const apiUrl = import.meta.env.VITE_API_URL;

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Generate 00-23 for hours
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
// Generate 00, 05, 10, ... 55 (5-minute intervals)
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

const defaultTimeSlot = { start_hour: '09', start_min: '00', end_hour: '10', end_min: '00' };

export default function ScheduleDialog({ open, onClose, taskId, existingSchedules, onSchedulesChanged }) {
  const [mode, setMode] = useState('date'); // 'date' or 'weekly'
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDays, setSelectedDays] = useState([new Date().getDay()]); // default: today
  const [timeSlots, setTimeSlots] = useState([{ ...defaultTimeSlot }]);
  const [saving, setSaving] = useState(false);
  const [schedules, setSchedules] = useState(existingSchedules || []);

  useEffect(() => {
    setSchedules(existingSchedules || []);
  }, [existingSchedules]);

  // Reset form when opening
  useEffect(() => {
    if (open) {
      setMode('date');
      setDate(new Date().toISOString().split('T')[0]);
      setSelectedDays([new Date().getDay()]);
      setTimeSlots([{ ...defaultTimeSlot }]);
    }
  }, [open]);

  const toggleDay = (dayIndex) => {
    setSelectedDays(prev =>
      prev.includes(dayIndex)
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex]
    );
  };

  const addTimeSlot = () => {
    setTimeSlots(prev => [...prev, { ...defaultTimeSlot }]);
  };

  const removeTimeSlot = (index) => {
    setTimeSlots(prev => prev.filter((_, i) => i !== index));
  };

  const updateTimeSlot = (index, field, value) => {
    setTimeSlots(prev => prev.map((slot, i) =>
      i === index ? { ...slot, [field]: value } : slot
    ));
  };

  const formatTime = (slot) => `${slot.start_hour}:${slot.start_min}`;
  const formatEndTime = (slot) => `${slot.end_hour}:${slot.end_min}`;

  const handleAddSchedules = async () => {
    setSaving(true);
    try {
      let datesToCreate = [];

      if (mode === 'date') {
        datesToCreate = [{ date, is_recurring: false }];
      } else {
        // Weekly mode: create one recurring schedule per selected day
        datesToCreate = selectedDays.map(dayIndex => ({
          date: null,
          is_recurring: true,
          recurrence_type: 'weekly',
          day_of_week: dayIndex,
        }));
      }

      for (const dayDef of datesToCreate) {
        for (const slot of timeSlots) {
          const startTime = formatTime(slot);
          const endTime = formatEndTime(slot);

          // Validate time order
          if (startTime >= endTime) continue;

          const body = {
            ...dayDef,
            start_time: startTime,
            end_time: endTime,
          };

          const res = await fetch(`${apiUrl}/api/tasks/${taskId}/schedules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

          if (res.ok) {
            const { id } = await res.json();
            setSchedules(prev => [...prev, { id, ...body }]);
          }
        }
      }

      if (onSchedulesChanged) onSchedulesChanged();
      onClose();
    } catch (err) {
      console.error('Erro ao adicionar horários:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    try {
      const res = await fetch(`${apiUrl}/api/schedules/${scheduleId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSchedules(prev => prev.filter(s => s.id !== scheduleId));
        if (onSchedulesChanged) onSchedulesChanged();
      }
    } catch (err) {
      console.error('Erro ao apagar horário:', err);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Schedule />
          Calendarizar Tarefa
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Existing schedules */}
        {schedules.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold', mb: 0.5, display: 'block' }}>
              Horários actuais:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {schedules.map(sched => (
                <Chip
                  key={sched.id}
                  label={formatScheduleSummary(sched)}
                  size="small"
                  onDelete={() => handleDeleteSchedule(sched.id)}
                  deleteIcon={<Delete fontSize="small" />}
                />
              ))}
            </Box>
            <Divider sx={{ my: 2 }} />
          </Box>
        )}

        {/* Mode selector */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button
            variant={mode === 'date' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setMode('date')}
          >
            Data específica
          </Button>
          <Button
            variant={mode === 'weekly' ? 'contained' : 'outlined'}
            size="small"
            onClick={() => setMode('weekly')}
          >
            Semanal (recorrente)
          </Button>
        </Box>

        {/* Date or day selection */}
        {mode === 'date' ? (
          <TextField
            type="date"
            size="small"
            fullWidth
            label="Data"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ mb: 2 }}
          />
        ) : (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 0.5 }}>
              Dias da semana:
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
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
        )}

        {/* Time slots list */}
        <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 1 }}>
          Horários:
        </Typography>

        {timeSlots.map((slot, index) => (
          <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            {/* Start time */}
            <FormControl size="small" sx={{ minWidth: 70 }}>
              <InputLabel>Hora</InputLabel>
              <Select
                value={slot.start_hour}
                onChange={(e) => updateTimeSlot(index, 'start_hour', e.target.value)}
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
                value={slot.start_min}
                onChange={(e) => updateTimeSlot(index, 'start_min', e.target.value)}
                label="Min"
              >
                {MINUTES.map(m => (
                  <MenuItem key={m} value={m}>{m}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Typography variant="body2" sx={{ px: 0.5 }}>→</Typography>

            {/* End time */}
            <FormControl size="small" sx={{ minWidth: 70 }}>
              <InputLabel>Hora</InputLabel>
              <Select
                value={slot.end_hour}
                onChange={(e) => updateTimeSlot(index, 'end_hour', e.target.value)}
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
                value={slot.end_min}
                onChange={(e) => updateTimeSlot(index, 'end_min', e.target.value)}
                label="Min"
              >
                {MINUTES.map(m => (
                  <MenuItem key={m} value={m}>{m}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Remove button */}
            {timeSlots.length > 1 && (
              <IconButton size="small" onClick={() => removeTimeSlot(index)} color="error">
                <Delete fontSize="small" />
              </IconButton>
            )}
          </Box>
        ))}

        {/* Add time slot button */}
        <Button
          size="small"
          startIcon={<Add />}
          onClick={addTimeSlot}
          sx={{ mt: 0.5 }}
        >
          Adicionar Horário
        </Button>

        {/* Summary */}
        <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f5f5f5', borderRadius: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
            Resumo:
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {mode === 'date'
              ? `Data: ${new Date(date + 'T00:00:00').toLocaleDateString('pt-PT')}`
              : `Dias: ${selectedDays.map(d => DAY_LABELS[d]).join(', ')}`
            }
            {' · '}
            {timeSlots.length} horário{timeSlots.length > 1 ? 's' : ''}
            {' · '}
            Total: {mode === 'date' ? timeSlots.length : selectedDays.length * timeSlots.length} entrada{selectedDays.length * timeSlots.length > 1 ? 's' : ''}
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleAddSchedules}
          disabled={
            saving ||
            (mode === 'date' && !date) ||
            (mode === 'weekly' && selectedDays.length === 0) ||
            timeSlots.length === 0 ||
            timeSlots.some(s => s.start_hour + ':' + s.start_min >= s.end_hour + ':' + s.end_min)
          }
        >
          {saving ? 'A guardar...' : 'Guardar Horários'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function formatScheduleSummary(sched) {
  if (sched.is_recurring || sched.schedule_is_recurring) {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    let recurrence = '';
    if (sched.recurrence_type === 'daily') recurrence = 'Diário';
    else if (sched.recurrence_type === 'weekly') recurrence = days[sched.day_of_week];
    else if (sched.recurrence_type === 'monthly') recurrence = `Dia ${sched.day_of_month}`;
    const time = sched.start_time && sched.end_time
      ? `${sched.start_time.slice(0, 5)}-${sched.end_time.slice(0, 5)}`
      : 'Todo o dia';
    return `${recurrence} ${time}`;
  } else {
    const date = sched.date ? new Date(sched.date + 'T00:00:00').toLocaleDateString('pt-PT') : 'Sem data';
    const time = sched.start_time && sched.end_time
      ? `${sched.start_time.slice(0, 5)}-${sched.end_time.slice(0, 5)}`
      : 'Todo o dia';
    return `${date} ${time}`;
  }
}