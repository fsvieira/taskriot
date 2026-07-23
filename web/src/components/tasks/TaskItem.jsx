import React, { useState, useEffect } from 'react';
import {
  ListItem,
  Checkbox,
  ListItemText,
  Collapse,
  IconButton,
  Box,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  FormControlLabel,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Typography,
} from '@mui/material';
import { ExpandLess, ExpandMore, Add, Delete, Edit, DragIndicator, Schedule } from '@mui/icons-material';
import ScheduleDialog from './ScheduleDialog';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

const apiUrl = import.meta.env.VITE_API_URL;

const getTaskColor = (perc) => {
  if (perc == null) return "#e3f2fd";
  const hue = 120 * (perc / 100);
  return `hsl(${hue}, 50%, 70%)`;
};

const parseTextWithLinks = (text) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'blue', textDecoration: 'underline' }}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

export default function TaskItem({ task, level = 0, onAddSubtask, onDeleteTask, onToggleDone, onEditTask }) {
  const [checked, setChecked] = useState(Boolean(task.completed));
  const [open, setOpen] = useState(level === 0);

  useEffect(() => {
    setChecked(Boolean(task.completed));
  }, [task.completed]);
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskData, setSubtaskData] = useState({
    title: '',
    is_recurring: false,
    recurrence_type: 'daily',
    objective: 1
  });

  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setChecked(Boolean(task.completed));
  }, [task.completed]);

  const [editData, setEditData] = useState({
    title: task.title,
    is_recurring: task.is_recurring || false,
    recurrence_type: task.recurrence_type || 'daily',
    objective: task.objective || 1
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [localCounter, setLocalCounter] = useState(task.current_counter || 0);
  const [schedules, setSchedules] = useState([]);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);

  const isRecurring = task.is_recurring;

  // dnd-kit: draggable handle for full row (handle-only activation)
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
    id: `drag-${task.id}`,
  });

  // dnd-kit: three drop zones per item
  const { setNodeRef: setBeforeRef, isOver: isOverBefore } = useDroppable({ id: `drop-before-${task.id}` });
  const { setNodeRef: setInsideRef, isOver: isOverInside } = useDroppable({ id: `drop-inside-${task.id}` });
  const { setNodeRef: setAfterRef, isOver: isOverAfter } = useDroppable({ id: `drop-after-${task.id}` });


  const toggleCheck = async () => {
    if (isRecurring) {
      // For recurring, increment counter
      await incrementCounter();
    } else {
      if (await onToggleDone(task.id, !checked)) {
        setChecked(!checked);
      }
    }
  };

  const incrementCounter = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ increment_counter: true }),
      });
      if (!response.ok) {
        console.error('Falha ao incrementar contador');
        return;
      }
      setLocalCounter(prev => prev + 1);
    } catch (err) {
      console.error('Erro ao incrementar contador:', err);
    }
  };

   const handleSaveEdit = async () => {
     if (editData.title.trim()) {
       const updates = { title: editData.title.trim() };
       if (editData.is_recurring !== task.is_recurring) updates.is_recurring = editData.is_recurring;
       if (editData.recurrence_type !== task.recurrence_type) updates.recurrence_type = editData.recurrence_type;
       if (editData.objective !== task.objective) updates.objective = editData.objective;
       if (await onEditTask(task.id, updates)) {
         setIsEditing(false);
       }
     }
     setIsEditing(false);
   };

  const handleAddSubtask = () => {
    if (!subtaskData.title.trim()) return;
    onAddSubtask(task.id, subtaskData);
    setSubtaskData({
      title: '',
      is_recurring: false,
      recurrence_type: 'daily',
      objective: 1
    });
    setAddingSubtask(false);
    setOpen(true);
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    onDeleteTask(task.id);
    setDeleteDialogOpen(false);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  // Fetch schedules for this task
  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/tasks/${task.id}/schedules`);
        if (res.ok) {
          const data = await res.json();
          setSchedules(data);
        }
      } catch (err) {
        console.error('Erro ao buscar schedules:', err);
      }
    };
    if (isEditing) {
      fetchSchedules();
    }
  }, [task.id, isEditing]);

  const handleScheduleChanged = () => {
    // Refresh schedules after dialog edits
    const fetchSchedules = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/tasks/${task.id}/schedules`);
        if (res.ok) {
          const data = await res.json();
          setSchedules(data);
        }
      } catch (err) {
        console.error('Erro ao buscar schedules:', err);
      }
    };
    fetchSchedules();
  };

  return (
    <>
      <Box
        ref={setBeforeRef}
        sx={{
          ml: level * 3,
          height: 8,
          borderRadius: 1,
          bgcolor: isOverBefore ? 'primary.main' : 'transparent',
          opacity: isOverBefore ? 0.4 : 0,
          transition: 'all 120ms ease',
        }}
      />
      <ListItem
        divider
        sx={{ pl: 0, pr: 0 }}
        secondaryAction={
          !isEditing &&
          <>
            <IconButton
              edge="end"
              onClick={() => setIsEditing(!isEditing)}
              size="small"
              title="Editar tarefa"
              sx={{ mr: 1 }}
            >
              <Edit />
            </IconButton>

            {level > 0 && (
              <IconButton
                edge="end"
                onClick={handleDelete}
                size="small"
                title="Apagar tarefa"
                sx={{ mr: 1 }}
              >
                <Delete />
              </IconButton>
            )}

            <IconButton
              edge="end"
              onClick={() => setAddingSubtask(!addingSubtask)}
              size="small"
              title="Adicionar subtarefa"
              sx={{ mr: 1 }}
            >
              <Add />
            </IconButton>

            {task.subtasks?.length > 0 && (
              <IconButton edge="end" onClick={() => setOpen(!open)} size="small">
                {open ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            )}
          </>
        }
      >
        <Box
          ref={setDragRef}
          style={{
            transform: CSS.Translate.toString(transform),
            opacity: isDragging ? 0.5 : 1,
          }}
          sx={{
            bgcolor: getTaskColor(task.percent_closed), // cor baseada na percentagem concluída
            borderRadius: 2,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            pl: 2,
            pr: 1,
            py: 1,
            ml: level * 3,
          }}
        >
          <IconButton size="small" {...attributes} {...listeners} sx={{ mr: 1, cursor: 'grab' }} title="Arrastar">
            <DragIndicator />
          </IconButton>
          {isRecurring ? (
            <Box
              sx={{
                mr: 1,
                fontSize: '0.875rem',
                fontWeight: 'bold',
                cursor: task.parent_id !== null ? 'pointer' : 'default',
                border: '1px solid #ccc',
                borderRadius: 1,
                px: 1,
                py: 0.5,
                minWidth: 50,
                textAlign: 'center',
                opacity: task.parent_id !== null ? 1 : 0.5,
              }}
              onClick={task.parent_id !== null ? toggleCheck : undefined}
            >
              {localCounter} / {task.objective}
            </Box>
          ) : task.parent_id !== null ? (
            <Checkbox checked={checked} onChange={toggleCheck} />
          ) : (
            // Root task - show static indicator instead of checkbox
            <Checkbox checked={checked} disabled />
          )}
          
          {isEditing ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 1 }}>
              <TextField
                value={editData.title}
                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                size="small"
                autoFocus
                fullWidth
                multiline
                minRows={1}
                maxRows={4}
                label="Título"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={editData.is_recurring}
                    onChange={(e) => setEditData({ ...editData, is_recurring: e.target.checked })}
                  />
                }
                label="Recorrente"
              />
              {editData.is_recurring && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Tipo</InputLabel>
                    <Select
                      value={editData.recurrence_type}
                      onChange={(e) => setEditData({ ...editData, recurrence_type: e.target.value })}
                      label="Tipo"
                    >
                      <MenuItem value="daily">Diário</MenuItem>
                      <MenuItem value="weekly">Semanal</MenuItem>
                      <MenuItem value="monthly">Mensal</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    type="number"
                    value={editData.objective}
                    onChange={(e) => setEditData({ ...editData, objective: parseInt(e.target.value) || 1 })}
                    size="small"
                    label="Objectivo"
                    sx={{ minWidth: 100 }}
                  />
                </Box>
              )}
              {/* Schedule Section */}
              <Box sx={{ mt: 1, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold', mb: 0.5, display: 'block' }}>
                  Calendarização
                </Typography>
                
                {/* Schedules count badge */}
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {schedules.length} horário{schedules.length !== 1 ? 's' : ''} definido{schedules.length !== 1 ? 's' : ''}
                </Typography>

                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Schedule />}
                  onClick={() => setScheduleDialogOpen(true)}
                >
                  {schedules.length > 0 ? 'Editar Horários' : 'Adicionar Horários'}
                </Button>
              </Box>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" variant="contained" onClick={handleSaveEdit}>
                  Salvar
                </Button>
                <Button size="small" variant="outlined" onClick={() => setIsEditing(false)}>
                  Cancelar
                </Button>
              </Box>
            </Box>
          ) : (
            <ListItemText
              primary={parseTextWithLinks(task.title)}
              sx={{
                textDecoration: (checked || (isRecurring && localCounter >= task.objective)) ? 'line-through' : 'none',
                whiteSpace: 'pre-wrap', // suporta multi-linha
                wordBreak: 'break-word',
                flex: 1,
                pr: '7.5em', // deixa espaço para as ações (ajusta conforme nº de botões)
              }}
            />
          )
          /*
          <ListItemText
            primary={task.title}
            sx={{ textDecoration: checked ? 'line-through' : 'none' }}
          />*/}
        </Box>
      </ListItem>

      <Box
        ref={setInsideRef}
        sx={{
          ml: (level + 1) * 3,
          height: 8,
          borderRadius: 1,
          bgcolor: isOverInside ? 'secondary.main' : 'transparent',
          opacity: isOverInside ? 0.35 : 0,
          transition: 'all 120ms ease',
        }}
      />

      {addingSubtask && (
        <ListItem sx={{ pl: (level + 1) * 4, mb: 1, flexDirection: 'column', alignItems: 'stretch' }}>
          <TextField
            value={subtaskData.title}
            onChange={(e) => setSubtaskData({ ...subtaskData, title: e.target.value })}
            size="small"
            placeholder="Nova subtarefa"
            autoFocus
            fullWidth
            multiline
            minRows={1}
            maxRows={4}
            sx={{ mb: 1 }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={subtaskData.is_recurring}
                onChange={(e) => setSubtaskData({ ...subtaskData, is_recurring: e.target.checked })}
              />
            }
            label="Recorrente"
            sx={{ mb: 1 }}
          />
          {subtaskData.is_recurring && (
            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Tipo</InputLabel>
                <Select
                  value={subtaskData.recurrence_type}
                  onChange={(e) => setSubtaskData({ ...subtaskData, recurrence_type: e.target.value })}
                  label="Tipo"
                >
                  <MenuItem value="daily">Diário</MenuItem>
                  <MenuItem value="weekly">Semanal</MenuItem>
                  <MenuItem value="monthly">Mensal</MenuItem>
                </Select>
              </FormControl>
              <TextField
                type="number"
                value={subtaskData.objective}
                onChange={(e) => setSubtaskData({ ...subtaskData, objective: parseInt(e.target.value) || 1 })}
                size="small"
                label="Objectivo"
                sx={{ minWidth: 100 }}
              />
            </Box>
          )}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" onClick={handleAddSubtask}>
              Adicionar
            </Button>
            <Button variant="outlined" onClick={() => setAddingSubtask(false)}>
              Cancelar
            </Button>
          </Box>
        </ListItem>
      )}

      {task.subtasks && (
        <Collapse in={open} timeout="auto" unmountOnExit>
          {task.subtasks.map((subtask) => (
            <TaskItem
              key={subtask.id}
              task={subtask}
              level={level + 1}
              onAddSubtask={onAddSubtask}
              onEditTask={onEditTask}
              onDeleteTask={onDeleteTask}
              onToggleDone={onToggleDone}
            />
          ))}
        </Collapse>
      )}
      <Box
        ref={setAfterRef}
        sx={{
          ml: level * 3,
          height: 8,
          borderRadius: 1,
          bgcolor: isOverAfter ? 'primary.main' : 'transparent',
          opacity: isOverAfter ? 0.4 : 0,
          transition: 'all 120ms ease',
          mb: 0.5
        }}
      />

      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-task-dialog-title"
        aria-describedby="delete-task-dialog-description"
      >
        <DialogTitle id="delete-task-dialog-title">
          Apagar Tarefa
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-task-dialog-description">
            Tem certeza de que deseja apagar a tarefa "{task.title}" e todas as suas subtarefas? Esta ação não pode ser desfeita.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="primary">
            Cancelar
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Apagar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Schedule Dialog */}
      <ScheduleDialog
        open={scheduleDialogOpen}
        onClose={() => setScheduleDialogOpen(false)}
        taskId={task.id}
        existingSchedules={schedules}
        onSchedulesChanged={handleScheduleChanged}
      />
    </>
  );
}
