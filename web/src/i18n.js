import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enGB from './locales/en-GB.json';
import ptPT from './locales/pt-PT.json';

const resources = {
  'en-GB': {
    translation: enGB,
  },
  'pt-PT': {
    translation: ptPT,
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: navigator.language || 'en-GB', // detect browser language, default to English
    fallbackLng: 'en-GB',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;