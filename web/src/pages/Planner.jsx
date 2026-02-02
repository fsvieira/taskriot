import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Typography, Card, CardContent, Grid } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { projectStore } from '../stores/ProjectStore';

const Planner = observer(() => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [projectsWithoutVision, setProjectsWithoutVision] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const projects = await projectStore.fetchProjectsWithoutVision();
      setProjectsWithoutVision(projects || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const visionPrompt = t('pages.planner.visionPrompt');

  if (loading) {
    return (
      <Box>
        <Typography variant="h4" sx={{ mt: 2, mb: 2 }}>
          {t('pages.planner.title')}
        </Typography>
        <Typography>{t('common.loading')}</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mt: 2, mb: 2 }}>
        {t('pages.planner.title')}
      </Typography>
      
      {projectsWithoutVision.length === 0 ? (
        <Typography color="text.secondary">
          {t('pages.planner.allProjectsHaveVision')}
        </Typography>
      ) : (
        <Grid container spacing={2}>
          {projectsWithoutVision.map((project) => (
            <Grid item xs={12} sm={6} md={4} key={project.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent>
                  <Typography variant="h6" component="div" gutterBottom>
                    {project.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {visionPrompt}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
});

export default Planner;
