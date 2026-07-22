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
  Chip,
} from '@mui/material';
import { ExpandLess, ExpandMore, Add, Delete, Edit, Check, DragIndicator, Schedule, Delete as DeleteIcon } from '@mui/icons-material';
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
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskData, setSubtaskData] = useState({
    title: '',
    is_recurring: false,
    recurrence_type: 'daily',
    objective: 1
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    title: task.title,
    is_recurring: task.is_recurring || false,
    recurrence_type: task.recurrence_type || 'daily',
    objective: task.objective || 1
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [localCounter, setLocalCounter] = useState(task.current_counter || 0);
  const [schedules, setSchedules] = useState([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    date: '',
    start_time: '',
    end_time: '',
    is_recurring: false,
    recurrence_type: 'weekly',
    day_of_week: 1,
    day_of_month: 1,
  });

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

  const handleAddSchedule = async () => {
    try {
      const body = {
        date: scheduleForm.date || null,
        start_time: scheduleForm.start_time || null,
        end_time: scheduleForm.end_time || null,
        is_recurring: scheduleForm.is_recurring,
        recurrence_type: scheduleForm.is_recurring ? scheduleForm.recurrence_type : null,
        day_of_week: scheduleForm.is_recurring && scheduleForm.recurrence_type === 'weekly' ? scheduleForm.day_of_week : null,
        day_of_month: scheduleForm.is_recurring && scheduleForm.recurrence_type === 'monthly' ? scheduleForm.day_of_month : null,
      };
      const res = await fetch(`${apiUrl}/api/tasks/${task.id}/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const { id } = await res.json();
        setSchedules(prev => [...prev, { id, ...body }]);
        setShowScheduleForm(false);
        setScheduleForm({
          date: '',
          start_time: '',
          end_time: '',
          is_recurring: false,
          recurrence_type: 'weekly',
          day_of_week: 1,
          day_of_month: 1,
        });
      }
    } catch (err) {
      console.error('Erro ao adicionar schedule:', err);
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    try {
      const res = await fetch(`${apiUrl}/api/schedules/${scheduleId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setSchedules(prev => prev.filter(s => s.id !== scheduleId));
      }
    } catch (err) {
      console.error('Erro ao apagar schedule:', err);
    }
  };

  const handleQuickDate = (preset) => {
    const today = new Date();
    let date;
    switch (preset) {
      case 'tomorrow':
        date = new Date(today);
        date.setDate(date.getDate() + 1);
        break;
      case 'nextWeek':
        date = new Date(today);
        date.setDate(date.getDate() + 7);
        break;
      case 'nextMonth':
        date = new Date(today);
        date.setMonth(date.getMonth() + 1);
        break;
      default:
        date = today;
    }
    setScheduleForm(prev => ({
      ...prev,
      date: date.toISOString().split('T')[0],
    }));
  };

  const formatScheduleSummary = (sched) => {
    if (sched.is_recurring) {
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
      const date = sched.date ? new Date(sched.date).toLocaleDateString('pt-PT') : 'Sem data';
      const time = sched.start_time && sched.end_time
        ? `${sched.start_time.slice(0, 5)}-${sched.end_time.slice(0, 5)}`
        : 'Todo o dia';
      return `${date} ${time}`;
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
                
                {/* Existing schedules */}
                {schedules.length > 0 && (
                  <Box sx={{ mb: 1 }}>
                    {schedules.map(sched => (
                      <Box key={sched.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                        <Chip
                          label={formatScheduleSummary(sched)}
                          size="small"
                          onDelete={() => handleDeleteSchedule(sched.id)}
                          deleteIcon={<DeleteIcon fontSize="small" />}
                        />
                      </Box>
                    ))}
                  </Box>
                )}

                {showScheduleForm ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        type="date"
                        size="small"
                        label="Data"
                        value={scheduleForm.date}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, date: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                        disabled={scheduleForm.is_recurring}
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        type="time"
                        size="small"
                        label="Início"
                        value={scheduleForm.start_time}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, start_time: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        type="time"
                        size="small"
                        label="Fim"
                        value={scheduleForm.end_time}
                        onChange={(e) => setScheduleForm({ ...scheduleForm, end_time: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                        sx={{ flex: 1 }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Button size="small" variant="outlined" onClick={() => handleQuickDate('tomorrow')}>Amanhã</Button>
                      <Button size="small" variant="outlined" onClick={() => handleQuickDate('nextWeek')}>Próx. Semana</Button>
                      <Button size="small" variant="outlined" onClick={() => handleQuickDate('nextMonth')}>Próx. Mês</Button>
                    </Box>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={scheduleForm.is_recurring}
                          onChange={(e) => setScheduleForm({ ...scheduleForm, is_recurring: e.target.checked })}
                          size="small"
                        />
                      }
                      label="Repetir"
                    />
                    {scheduleForm.is_recurring && (
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <FormControl size="small" sx={{ minWidth: 100 }}>
                          <InputLabel>Frequência</InputLabel>
                          <Select
                            value={scheduleForm.recurrence_type}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, recurrence_type: e.target.value })}
                            label="Frequência"
                          >
                            <MenuItem value="daily">Diário</MenuItem>
                            <MenuItem value="weekly">Semanal</MenuItem>
                            <MenuItem value="monthly">Mensal</MenuItem>
                          </Select>
                        </FormControl>
                        {scheduleForm.recurrence_type === 'weekly' && (
                          <FormControl size="small" sx={{ minWidth: 100 }}>
                            <InputLabel>Dia</InputLabel>
                            <Select
                              value={scheduleForm.day_of_week}
                              onChange={(e) => setScheduleForm({ ...scheduleForm, day_of_week: e.target.value })}
                              label="Dia"
                            >
                              <MenuItem value={0}>Dom</MenuItem>
                              <MenuItem value={1}>Seg</MenuItem>
                              <MenuItem value={2}>Ter</MenuItem>
                              <MenuItem value={3}>Qua</MenuItem>
                              <MenuItem value={4}>Qui</MenuItem>
                              <MenuItem value={5}>Sex</MenuItem>
                              <MenuItem value={6}>Sáb</MenuItem>
                            </Select>
                          </FormControl>
                        )}
                        {scheduleForm.recurrence_type === 'monthly' && (
                          <TextField
                            type="number"
                            size="small"
                            label="Dia do mês"
                            value={scheduleForm.day_of_month}
                            onChange={(e) => setScheduleForm({ ...scheduleForm, day_of_month: parseInt(e.target.value) || 1 })}
                            inputProps={{ min: 1, max: 31 }}
                            sx={{ minWidth: 100 }}
                          />
                        )}
                      </Box>
                    )}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button size="small" variant="contained" onClick={handleAddSchedule}>Adicionar</Button>
                      <Button size="small" variant="outlined" onClick={() => setShowScheduleForm(false)}>Cancelar</Button>
                    </Box>
                  </Box>
                ) : (
                  <Button
                    size="small"
                    startIcon={<Schedule />}
                    onClick={() => setShowScheduleForm(true)}
                  >
                    Adicionar Horário
                  </Button>
                )}
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
    </>
  );
}
