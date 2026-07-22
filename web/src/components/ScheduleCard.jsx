import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  Typography,
  Checkbox,
  Box,
  Divider,
} from '@mui/material';
import {
  AccessTime,
} from '@mui/icons-material';

const ScheduleCard = ({ entry, onComplete, statusColor }) => {
  const { t } = useTranslation();

  // Derive checked directly from props (not useState) to avoid stale state
  const checked = entry.do_task ? entry.do_task.completed : entry.completed;

  const isRecurring = entry.do_task?.is_recurring || entry.is_recurring;
  const currentCounter = entry.do_task?.current_counter ?? entry.current_counter ?? 0;
  const objective = entry.do_task?.objective ?? entry.objective ?? 1;

  const handleToggleCheck = () => {
    if (!checked) {
      onComplete();
    }
  };

  const formatTime = (time) => {
    if (!time || time === '00:00' || time === '23:59') return '';
    return time;
  };

  const getCardBackground = (status) => {
    switch (status) {
      case 'active':
        return 'rgba(76, 175, 80, 0.08)';
      case 'recent':
        return 'rgba(255, 152, 0, 0.08)';
      case 'upcoming':
        return 'rgba(33, 150, 243, 0.05)';
      default:
        return '#ffffff';
    }
  };

  const getBorderColor = (status) => {
    switch (status) {
      case 'active':
        return 'success.main';
      case 'recent':
        return 'warning.main';
      case 'upcoming':
        return 'info.main';
      default:
        return 'grey.300';
    }
  };

  const taskTitle = entry.do_task ? entry.do_task.title : entry.task_title;
  const hasTime = formatTime(entry.start_time) !== '' || formatTime(entry.end_time) !== '';
  const isPast = entry.status === 'recent';

  return (
    <Card
      sx={{
        borderLeft: 4,
        borderColor: getBorderColor(entry.status),
        backgroundColor: getCardBackground(entry.status),
        transition: 'all 0.3s ease',
        opacity: isPast ? 0.7 : 1,
        '&:hover': {
          boxShadow: 3,
        },
      }}
    >
      <CardContent sx={{ py: 2 }}>
        {/* Time Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <AccessTime fontSize="small" color="action" />
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 'bold',
              color: statusColor,
            }}
          >
            {hasTime
              ? `${formatTime(entry.start_time) || '00:00'} - ${formatTime(entry.end_time) || '23:59'}`
              : t('pages.planner.allDay')}
          </Typography>
          <Box
            sx={{
              ml: 'auto',
              width: 12,
              height: 12,
              borderRadius: '50%',
              bgcolor: statusColor,
            }}
          />
        </Box>

        <Divider sx={{ mb: 1.5 }} />

        {/* Project Name */}
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 0.5 }}>
          {entry.project_name}
        </Typography>

        {/* Path */}
        {entry.path && (
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              fontSize: '0.8rem',
              mb: 0.5,
            }}
          >
            {entry.path}
          </Typography>
        )}

        {/* Task Title */}
        <Typography
          variant="body1"
          sx={{
            textDecoration: checked ? 'line-through' : 'none',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            mb: 1,
          }}
        >
          {taskTitle}
        </Typography>

        {/* Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
          {isRecurring ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                border: '1px solid #ccc',
                borderRadius: 1,
                px: 1.5,
                py: 0.5,
                cursor: checked ? 'default' : 'pointer',
                opacity: checked ? 0.6 : 1,
              }}
              onClick={!checked ? handleToggleCheck : undefined}
            >
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                {currentCounter} / {objective}
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Checkbox
                checked={checked}
                onChange={handleToggleCheck}
                size="small"
              />
              <Typography variant="body2">
                {checked ? t('pages.planner.completed') : t('pages.planner.complete')}
              </Typography>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default ScheduleCard;