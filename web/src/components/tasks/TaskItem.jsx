import React, { useState, useEffect, useRef } from 'react';
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
  Chip,
  Snackbar,
  Alert,
} from '@mui/material';
import { ExpandLess, ExpandMore, Add, Delete, Tune, DragIndicator, Check, Close, FileCopy, ContentCopy } from '@mui/icons-material';
import TaskSettingsDialog from './TaskSettingsDialog';
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

export default function TaskItem({ task, level = 0, onAddSubtask, onDeleteTask, onToggleDone, onEditTask, onCopyTask }) {
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

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [localCounter, setLocalCounter] = useState(task.current_counter || 0);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [taskLabels, setTaskLabels] = useState([]);
  const [labelsLoading, setLabelsLoading] = useState(true);
  const [labelsRefreshKey, setLabelsRefreshKey] = useState(0);
  const [copyingMarkdown, setCopyingMarkdown] = useState(false);
  const [copyingTask, setCopyingTask] = useState(false);
  const [copyToastOpen, setCopyToastOpen] = useState(false);

  // Inline editing state
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(task.title);
  const editInputRef = useRef(null);

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

  // Inline edit handlers
  const startEditing = () => {
    setEditTitleValue(task.title);
    setEditingTitle(true);
  };

  const saveInlineEdit = async () => {
    const newTitle = editTitleValue.trim();
    if (!newTitle || newTitle === task.title) {
      setEditingTitle(false);
      return;
    }
    try {
      await fetch(`${apiUrl}/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      if (onEditTask) onEditTask(task.id, {});
    } catch (err) {
      console.error('Erro ao editar tarefa:', err);
    }
    setEditingTitle(false);
  };

  const handleInlineEditKeyDown = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      saveInlineEdit();
    } else if (e.key === 'Escape') {
      cancelInlineEdit();
    }
  };

  const cancelInlineEdit = () => {
    setEditTitleValue(task.title);
    setEditingTitle(false);
  };

  // Fetch labels for this task
  useEffect(() => {
    let cancelled = false;
    setLabelsLoading(true);
    const fetchLabels = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/tasks/${task.id}/labels`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setTaskLabels(data);
        }
      } catch (err) {
        console.error('Erro ao buscar labels:', err);
      } finally {
        if (!cancelled) setLabelsLoading(false);
      }
    };
    fetchLabels();
    return () => { cancelled = true; };
  }, [task.id, labelsRefreshKey]);

  const handleSettingsSavedOrDeleted = () => {
    setLabelsRefreshKey(prev => prev + 1);
    if (onEditTask) {
      onEditTask(task.id, {});
    }
  };

  const copyMarkdown = async () => {
    try {
      setCopyingMarkdown(true);
      const response = await fetch(`${apiUrl}/api/tasks/${task.id}/markdown`);
      if (!response.ok) {
        console.error('Falha ao buscar markdown');
        return;
      }
      const data = await response.json();
      await navigator.clipboard.writeText(data.markdown || '');
      setCopyToastOpen(true);
    } catch (err) {
      console.error('Erro ao copiar markdown:', err);
    } finally {
      setCopyingMarkdown(false);
    }
  };

  const copyTask = async () => {
    try {
      setCopyingTask(true);
      const response = await fetch(`${apiUrl}/api/tasks/${task.id}/copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        console.error('Falha ao copiar tarefa');
        return;
      }
      const newTask = await response.json();
      // If the copied task has no children and is not a root task, normalize parent to null
      if (newTask.parent_id !== null && !newTask.subtasks?.length) {
        await fetch(`${apiUrl}/api/tasks/${newTask.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parent_id: null }),
        });
      }
      if (onCopyTask) onCopyTask(newTask);
      if (onEditTask) onEditTask(newTask.id, {});
      setCopyToastOpen(true);
    } catch (err) {
      console.error('Erro ao copiar tarefa:', err);
    } finally {
      setCopyingTask(false);
    }
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
          <>
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

            <IconButton
              edge="end"
              onClick={copyTask}
              size="small"
              title="Copiar tarefa"
              sx={{ mr: 1 }}
              disabled={copyingTask}
            >
              <ContentCopy />
            </IconButton>

            <IconButton
              edge="end"
              onClick={copyMarkdown}
              size="small"
              title="Copiar markdown"
              sx={{ mr: 1 }}
              disabled={copyingMarkdown}
            >
              <FileCopy />
            </IconButton>

            <IconButton
              edge="end"
              onClick={() => setSettingsDialogOpen(true)}
              size="small"
              title="Configurações"
              sx={{ mr: 1 }}
            >
              <Tune />
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
            bgcolor: getTaskColor(task.percent_closed),
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
            <Checkbox checked={checked} disabled />
          )}

          <ListItemText
            primary={
              <Box>
                {!labelsLoading && taskLabels.length > 0 && (
                  <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap', mb: 0.3 }}>
                    {taskLabels.map(label => (
                      <Chip
                        key={label.id}
                        label={label.name}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          fontWeight: 500,
                        }}
                      />
                    ))}
                  </Box>
                )}
                {editingTitle ? (
                  <Box>
                    <TextField
                      ref={editInputRef}
                      value={editTitleValue}
                      onChange={(e) => setEditTitleValue(e.target.value)}
                      onKeyDown={handleInlineEditKeyDown}
                      size="small"
                      fullWidth
                      multiline
                      minRows={1}
                      maxRows={4}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      sx={{
                        '& .MuiInputBase-root': {
                          fontSize: 'inherit',
                          bgcolor: 'white',
                        },
                      }}
                    />
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={saveInlineEdit}
                        startIcon={<Check />}
                      >
                        Salvar
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={cancelInlineEdit}
                        startIcon={<Close />}
                      >
                        Cancelar
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <Box
                    component="span"
                    onClick={startEditing}
                    sx={{
                      textDecoration: (checked || (isRecurring && localCounter >= task.objective)) ? 'line-through' : 'none',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: 'rgba(0,0,0,0.04)',
                        borderRadius: 0.5,
                      },
                    }}
                  >
                    {parseTextWithLinks(task.title)}
                  </Box>
                )}
              </Box>
            }
            sx={{ flex: 1, pr: '5em' }}
          />
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
            label="Objectivo"
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

      {/* Task Settings Dialog - inline edit for title, labels and objective/habit */}
      <TaskSettingsDialog
        open={settingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        task={task}
        onSaved={handleSettingsSavedOrDeleted}
        onDeleted={handleSettingsSavedOrDeleted}
      />

      {/* Toast notification for copy */}
      <Snackbar
        open={copyToastOpen}
        autoHideDuration={3000}
        onClose={() => setCopyToastOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setCopyToastOpen(false)} severity="success" sx={{ width: '100%' }}>
          Tarefa copiada
        </Alert>
      </Snackbar>
    </>
  );
}