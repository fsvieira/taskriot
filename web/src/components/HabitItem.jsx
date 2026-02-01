import React from 'react';
import { ListItem, ListItemText, Button } from '@mui/material';

const getTaskColor = (perc) => {
  if (perc == null) return "#e3f2fd";
  const hue = 120 * (perc / 100);
  return `hsl(${hue}, 50%, 70%)`;
};

function HabitItem({ task, onIncrement }) {
  const isDone = (task.current_counter ?? 0) >= (task.objective ?? 0);

  return (
    <ListItem
      sx={{
        bgcolor: getTaskColor(task.percent_closed),
        borderRadius: 1,
        mb: 1,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <Button
        variant="contained"
        size="small"
        onClick={() => onIncrement(task.id)}
        sx={{ mr: 2, minWidth: 60 }}
      >
        {task.current_counter} / {task.objective}
      </Button>
      <ListItemText
        primary={task.title}
        sx={{
          textDecoration: isDone ? 'line-through' : 'none',
        }}
      />
    </ListItem>
  );
}

export default HabitItem;