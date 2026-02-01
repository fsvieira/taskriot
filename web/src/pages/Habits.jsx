import React from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography } from '@mui/material';
import HabitsWidget from '../components/HabitsWidget';

export default function Habits() {
  const { t } = useTranslation();

  return (
    <Box>
      <Typography variant="h4" sx={{ mt: 2, mb: 2 }}>
        {t('pages.habits.title')}
      </Typography>
      <HabitsWidget />
    </Box>
  );
}