import React, { useState, useEffect, useRef } from 'react';
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
  DialogContentText,
  Collapse,
} from '@mui/material';
import { Add, Delete, Schedule, Close, ExpandMore, ExpandLess } from '@mui/icons-material';

const apiUrl = import.meta.env.VITE_API_URL;

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Generate 00-23 for hours
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
// Generate 00, 05, 10, ... 55 (5-minute intervals)
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

const defaultTimeSlot = { start_hour: '09', start_min: '00', end_hour: '10', end_min: '00' };

export default function EditTaskDialog({ open, onClose, task, onSaved, onDeleted }) {
  // Task fields
  const [title, setTitle] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState('daily');
  const [objective, setObjective] = useState(1);

  // Schedule fields
  const [schedules, setSchedules] = useState([]);
  const [scheduleMode, setScheduleMode] = useState('date');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDays, setSelectedDays] = useState([new Date().getDay()]);
  const [timeSlots, setTimeSlots] = useState([{ ...defaultTimeSlot }]);

  // UI state
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [initialSchedules, setInitialSchedules] = useState([]);
  const [scheduleSectionOpen, setScheduleSectionOpen] = useState(false);

  // Ref to track if the dialog has been initialized
  const initializedRef = useRef(false);

  // Load task data only when the dialog opens (not on task prop changes while open)
  useEffect(() => {
    if (open) {
      // Only initialize if we haven't done so yet
      if (!initializedRef.current) {
        initializedRef.current = true;
        setTitle(task?.title || '');
        setIsRecurring(task?.is_recurring || false);
        setRecurrenceType(task?.recurrence_type || 'daily');
        setObjective(task?.objective || 1);
        setScheduleMode('date');
        setDate(new Date().toISOString().split('T')[0]);
        setSelectedDays([new Date().getDay()]);
        setTimeSlots([{ ...defaultTimeSlot }]);
        fetchSchedules();
      }
    } else {
      // Reset the flag when dialog closes so it re-initializes on next open
      initializedRef.current = false;
    }
  }, [open]);

  const fetchSchedules = async () => {
    if (!task) return;
    try {
      const res = await fetch(`${apiUrl}/api/tasks/${task.id}/schedules`);
      if (res.ok) {
        const data = await res.json();
        setSchedules(data);
        setInitialSchedules(JSON.parse(JSON.stringify(data))); // deep copy for comparison
      }
    } catch (err) {
      console.error('Erro ao buscar schedules:', err);
    }
  };

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

  const handleDeleteSchedule = (scheduleId) => {
    setSchedules(prev => prev.filter(s => s.id !== scheduleId));
  };

  const handleAddSchedulesToState = () => {
    const newSchedules = [];

    if (scheduleMode === 'date') {
      newSchedules.push({ date, is_recurring: false, _new: true });
    } else {
      newSchedules.push(...selectedDays.map(dayIndex => ({
        date: null,
        is_recurring: true,
        recurrence_type: 'weekly',
        day_of_week: dayIndex,
        _new: true,
      })));
    }

    const slotsToAdd = [];
    for (const dayDef of newSchedules) {
      for (const slot of timeSlots) {
        const startTime = formatTime(slot);
        const endTime = formatEndTime(slot);
        if (startTime >= endTime) continue;
        slotsToAdd.push({
          ...dayDef,
          start_time: startTime,
          end_time: endTime,
          _new: true,
        });
      }
    }

    setSchedules(prev => [...prev, ...slotsToAdd]);
    setTimeSlots([{ ...defaultTimeSlot }]);
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);

    try {
      // 1. Update task fields
      const taskUpdates = {
        title: title.trim(),
        is_recurring: isRecurring,
        recurrence_type: isRecurring ? recurrenceType : null,
        objective: isRecurring ? objective : null,
      };

      const taskRes = await fetch(`${apiUrl}/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskUpdates),
      });

      if (!taskRes.ok) {
        console.error('Falha ao atualizar tarefa');
        setSaving(false);
        return;
      }

      // 2. Sync schedules: delete removed ones, create new ones
      const currentIds = schedules.filter(s => !s._new).map(s => s.id);
      const initialIds = initialSchedules.map(s => s.id);

      // Schedules to delete: were in initial but not in current
      const toDelete = initialSchedules.filter(s => !currentIds.includes(s.id));
      // Schedules to create: have _new flag
      const toCreate = schedules.filter(s => s._new);

      // Delete removed schedules
      for (const sched of toDelete) {
        await fetch(`${apiUrl}/api/schedules/${sched.id}`, {
          method: 'DELETE',
        });
      }

      // Create new schedules
      for (const sched of toCreate) {
        const body = {
          date: sched.date || null,
          start_time: sched.start_time,
          end_time: sched.end_time,
          is_recurring: sched.is_recurring || false,
          recurrence_type: sched.recurrence_type || null,
          day_of_week: sched.day_of_week ?? null,
          day_of_month: sched.day_of_month ?? null,
        };

        await fetch(`${apiUrl}/api/tasks/${task.id}/schedules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error('Erro ao guardar edição:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/tasks/${task.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setDeleteDialogOpen(false);
        if (onDeleted) onDeleted();
        onClose();
      }
    } catch (err) {
      console.error('Erro ao apagar tarefa:', err);
    }
  };

  const formatScheduleSummary = (sched) => {
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
      const dateStr = sched.date ? new Date(sched.date + 'T00:00:00').toLocaleDateString('pt-PT') : 'Sem data';
      const time = sched.start_time && sched.end_time
        ? `${sched.start_time.slice(0, 5)}-${sched.end_time.slice(0, 5)}`
        : 'Todo o dia';
      return `${dateStr} ${time}`;
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Editar Tarefa</Typography>
            <IconButton size="small" onClick={onClose}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          {/* === TASK DETAILS SECTION === */}
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
            Detalhes
          </Typography>

          <TextField
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            size="small"
            fullWidth
            multiline
            minRows={1}
            maxRows={4}
            label="Título"
            sx={{ mb: 1.5 }}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
              />
            }
            label="Recorrente"
            sx={{ mb: 1.5 }}
          />

          {isRecurring && (
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Tipo</InputLabel>
                <Select
                  value={recurrenceType}
                  onChange={(e) => setRecurrenceType(e.target.value)}
                  label="Tipo"
                >
                  <MenuItem value="daily">Diário</MenuItem>
                  <MenuItem value="weekly">Semanal</MenuItem>
                  <MenuItem value="monthly">Mensal</MenuItem>
                </Select>
              </FormControl>
              <TextField
                type="number"
                value={objective}
                onChange={(e) => setObjective(parseInt(e.target.value) || 1)}
                size="small"
                label="Objectivo"
                sx={{ minWidth: 100 }}
              />
            </Box>
          )}

          {/* === SCHEDULE SECTION - Collapsible === */}
          <Divider sx={{ my: 2 }} />
          
          <Box
            onClick={() => setScheduleSectionOpen(prev => !prev)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              py: 0.5,
              '&:hover': { bgcolor: '#f5f5f5', borderRadius: 1 },
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              Calendarização
            </Typography>
            <IconButton size="small">
              {scheduleSectionOpen ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>

          <Collapse in={scheduleSectionOpen}>

          {/* Existing schedules */}
          {schedules.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', mb: 0.5, display: 'block' }}>
                Horários actuais:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {schedules.map((sched, index) => (
                  <Chip
                    key={sched._new ? `new-${index}` : sched.id}
                    label={formatScheduleSummary(sched)}
                    size="small"
                    onDelete={() => handleDeleteSchedule(sched.id)}
                    deleteIcon={<Delete fontSize="small" />}
                    color={sched._new ? 'success' : 'default'}
                    variant={sched._new ? 'filled' : 'outlined'}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Mode selector */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button
              variant={scheduleMode === 'date' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setScheduleMode('date')}
            >
              Data específica
            </Button>
            <Button
              variant={scheduleMode === 'weekly' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setScheduleMode('weekly')}
            >
              Semanal (recorrente)
            </Button>
          </Box>

          {/* Date or day selection */}
          {scheduleMode === 'date' ? (
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
            sx={{ mt: 0.5, mr: 1 }}
          >
            Adicionar Horário
          </Button>

          {/* Add schedules to list button */}
          <Button
            size="small"
            variant="contained"
            startIcon={<Schedule />}
            onClick={handleAddSchedulesToState}
            sx={{ mt: 0.5 }}
            disabled={
              (scheduleMode === 'date' && !date) ||
              (scheduleMode === 'weekly' && selectedDays.length === 0) ||
              timeSlots.length === 0 ||
              timeSlots.some(s => s.start_hour + ':' + s.start_min >= s.end_hour + ':' + s.end_min)
            }
          >
            Adicionar à lista
          </Button>
          </Collapse>
        </DialogContent>

        <DialogActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
          <Button
            color="error"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={saving}
          >
            Apagar Tarefa
          </Button>
          <Box>
            <Button onClick={onClose} disabled={saving} sx={{ mr: 1 }}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving || !title.trim()}
            >
              {saving ? 'A guardar...' : 'Guardar'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Apagar Tarefa</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Tem certeza de que deseja apagar a tarefa "{task?.title}" e todas as suas subtarefas? Esta ação não pode ser desfeita.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} color="primary">
            Cancelar
          </Button>
          <Button onClick={handleDeleteTask} color="error" variant="contained">
            Apagar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}