import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormControlLabel,
  Checkbox,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Divider,
  DialogContentText,
  Autocomplete,
  IconButton,
} from '@mui/material';
import { Close, Label as LabelIcon } from '@mui/icons-material';

const apiUrl = import.meta.env.VITE_API_URL;

export default function TaskSettingsDialog({ open, onClose, task, onSaved, onDeleted }) {
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState('daily');
  const [objective, setObjective] = useState(1);

  // Labels
  const [allLabels, setAllLabels] = useState([]);
  const [taskLabelIds, setTaskLabelIds] = useState([]);

  // UI state
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const initializedRef = useRef(false);

  useEffect(() => {
    if (open) {
      if (!initializedRef.current) {
        initializedRef.current = true;
        setIsRecurring(task?.is_recurring || false);
        setRecurrenceType(task?.recurrence_type || 'daily');
        setObjective(task?.objective || 1);
        fetchLabels();
        fetchTaskLabels();
      }
    } else {
      initializedRef.current = false;
    }
  }, [open]);

  const fetchLabels = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/labels`);
      if (res.ok) {
        const data = await res.json();
        setAllLabels(data);
      }
    } catch (err) {
      console.error('Erro ao buscar labels:', err);
    }
  };

  const fetchTaskLabels = async () => {
    if (!task) return;
    try {
      const res = await fetch(`${apiUrl}/api/tasks/${task.id}/labels`);
      if (res.ok) {
        const data = await res.json();
        setTaskLabelIds(data.map(l => l.id));
      }
    } catch (err) {
      console.error('Erro ao buscar labels da tarefa:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Update task fields
      const taskUpdates = {
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

      // 2. Update task labels
      await fetch(`${apiUrl}/api/tasks/${task.id}/labels`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label_ids: taskLabelIds }),
      });

      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error('Erro ao guardar configurações:', err);
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

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Configurações da Tarefa</Typography>
            <IconButton size="small" onClick={onClose}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          {/* === OBJECTIVE / HABIT SECTION === */}
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
            Objectivo / Hábito
          </Typography>

          <FormControlLabel
            control={
              <Checkbox
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
              />
            }
            label="Activar objectivo"
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

          {/* === LABELS SECTION === */}
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LabelIcon fontSize="small" />
              Fases
            </Box>
          </Typography>

          <Autocomplete
            multiple
            size="small"
            options={allLabels}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            value={allLabels.filter(l => taskLabelIds.includes(l.id))}
            onChange={(event, newValue) => {
              setTaskLabelIds(newValue.map(v => v.id));
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                variant="outlined"
                label="Selecionar fases"
                placeholder="Adicionar fase..."
              />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  label={option.name}
                  size="small"
                  {...getTagProps({ index })}
                />
              ))
            }
            sx={{ mb: 2 }}
          />
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
              disabled={saving}
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