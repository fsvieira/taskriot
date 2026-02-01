import React, { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
} from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
import MoodBadIcon from '@mui/icons-material/MoodBad';
import SentimentSatisfiedIcon from '@mui/icons-material/SentimentSatisfied';
import SentimentSatisfiedAltIcon from '@mui/icons-material/SentimentSatisfiedAlt';

const EmotionalIndicatorsModal = ({ open, onClose, project, onSave }) => {
  const { t } = useTranslation();
  const [selections, setSelections] = useState([2, 2, 2]);

  useEffect(() => {
    if (open) {
      const fetchCurrent = async () => {
        try {
          const baseUrl = import.meta.env.VITE_API_URL;
          const response = await fetch(`${baseUrl}/api/projects/${project.id}/emotional-indicators`);
          if (response.ok) {
            const data = await response.json();
            const indicators = data.indicators;
            setSelections([
              indicators[1] ?? 2,
              indicators[2] ?? 2,
              indicators[3] ?? 2,
            ]);
          } else {
            setSelections([2, 2, 2]);
          }
        } catch (err) {
          console.error('Erro ao buscar indicadores atuais:', err);
          setSelections([2, 2, 2]);
        }
      };
      fetchCurrent();
    }
  }, [open, project.id]);

  const questions = [
    t('pages.projects.card.question1'),
    t('pages.projects.card.question2'),
    t('pages.projects.card.question3'),
  ];

  const options = [
    { label: t('pages.projects.card.no'), icon: MoodBadIcon, value: 1, color: 'error' },
    { label: t('pages.projects.card.yes'), icon: SentimentSatisfiedIcon, value: 2, color: 'warning' },
    { label: t('pages.projects.card.very'), icon: SentimentSatisfiedAltIcon, value: 3, color: 'success' },
  ];

  const handleSelect = (questionIndex, value) => {
    const newSelections = [...selections];
    newSelections[questionIndex] = value;
    setSelections(newSelections);
  };

  const handleSave = async () => {
    const indicators = selections.map((value, index) => ({
      indicator: index + 1,
      value,
    })).filter(ind => ind.value !== null);

    if (indicators.length === 0) return;

    try {
      const baseUrl = import.meta.env.VITE_API_URL;
      const response = await fetch(`${baseUrl}/api/projects/${project.id}/emotional-indicators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indicators }),
      });
      if (!response.ok) {
        throw new Error('Failed to save emotional indicators');
      }
      if (onSave) onSave();
      onClose();
      setSelections([2, 2, 2]);
    } catch (error) {
      console.error('Error saving emotional indicators:', error);
    }
  };

  const handleClose = () => {
    onClose();
    setSelections([2, 2, 2]);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t('pages.projects.card.emotionalIndicators')} - {project.name}
        <IconButton
          onClick={handleClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: 'grey.500',
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {questions.map((question, index) => (
          <Box key={index} sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {question}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              {options.map((option) => (
                <Button
                  key={option.value}
                  variant={selections[index] === option.value ? 'contained' : 'outlined'}
                  onClick={() => handleSelect(index, option.value)}
                  sx={(theme) => ({
                    minWidth: 80,
                    minHeight: 80,
                    fontSize: '2rem',
                    backgroundColor: selections[index] === option.value ? theme.palette[option.color].main : 'transparent',
                    color: selections[index] === option.value ? 'white' : theme.palette[option.color].main,
                    borderColor: theme.palette[option.color].main,
                    borderRadius: '50%',
                    '&:hover': {
                      backgroundColor: theme.palette[option.color].main,
                      color: 'white',
                    },
                  })}
                >
                  <option.icon sx={{ fontSize: '2rem' }} />
                </Button>
              ))}
            </Box>
          </Box>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t('common.cancel')}</Button>
        <Button onClick={handleSave} variant="contained" disabled={selections.some(s => s === null)}>
          {t('common.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EmotionalIndicatorsModal;