import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
} from '@mui/material';
import { Language } from '@mui/icons-material';

export default function LanguageSelector() {
  const { i18n, t } = useTranslation();

  const handleLanguageChange = (event) => {
    const selectedLanguage = event.target.value;
    i18n.changeLanguage(selectedLanguage);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Language />
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel>{t('account.language')}</InputLabel>
        <Select
          value={i18n.language}
          label={t('account.language')}
          onChange={handleLanguageChange}
        >
          <MenuItem value="en-GB">{t('account.english')}</MenuItem>
          <MenuItem value="pt-PT">{t('account.portuguese')}</MenuItem>
        </Select>
      </FormControl>
    </Box>
  );
}