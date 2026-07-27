import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Tabs,
  Tab,
} from '@mui/material';
import {
  CalendarMonth,
  Label,
  Schedule,
  Assignment,
} from '@mui/icons-material';
import ScheduleView from '../components/planner/ScheduleView';
import LabelsManager from '../components/planner/LabelsManager';
import LabelScheduler from '../components/planner/LabelScheduler';
import ProjectScheduler from '../components/planner/ProjectScheduler';

const Planner = () => {
  const { t } = useTranslation();
  const [tabIndex, setTabIndex] = useState(0);

  const handleTabChange = (event, newValue) => {
    setTabIndex(newValue);
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mt: 2, mb: 2 }}>
        {t('pages.planner.title')}
      </Typography>

      <Tabs
        value={tabIndex}
        onChange={handleTabChange}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab
          icon={<CalendarMonth />}
          iconPosition="start"
          label={t('pages.planner.tabSchedule')}
        />
        <Tab
          icon={<Label />}
          iconPosition="start"
          label={t('pages.planner.tabLabels')}
        />
        <Tab
          icon={<Schedule />}
          iconPosition="start"
          label={t('pages.planner.tabScheduling')}
        />
        <Tab
          icon={<Assignment />}
          iconPosition="start"
          label={t('pages.planner.tabProjects')}
        />
      </Tabs>

      {tabIndex === 0 && <ScheduleView />}
      {tabIndex === 1 && <LabelsManager />}
      {tabIndex === 2 && <LabelScheduler />}
      {tabIndex === 3 && <ProjectScheduler />}
    </Box>
  );
};

export default Planner;