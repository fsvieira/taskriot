import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Typography,
  Paper,
  Box,
  Divider,
} from '@mui/material';
import { AccountCircle } from '@mui/icons-material';
import LanguageSelector from '../components/LanguageSelector';

export default function Account() {
  const { t } = useTranslation();

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <AccountCircle sx={{ mr: 2, fontSize: 40, color: 'primary.main' }} />
          <Typography variant="h4" component="h1">
            {t('account.title')}
          </Typography>
        </Box>

        <Divider sx={{ mb: 3 }} />

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            {t('account.language')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('account.languageDescription')}
          </Typography>
          <LanguageSelector />
        </Box>

        {/* Future account settings can be added here */}
        <Box sx={{ mt: 4 }}>
          <Typography variant="body2" color="text.secondary">
            {t('account.futureSettings')}
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}