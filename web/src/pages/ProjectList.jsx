import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  List,
  ListItem,
  Fab,
  Typography,
  Box,
  Stack,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';

import EditIcon from '@mui/icons-material/Edit';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

import ProjectForm from '../components/ProjectForm.jsx';
import ProjectManagerDialog from '../components/ProjectManagerDialog.jsx';

import { observer } from 'mobx-react-lite';
import { projectStore } from '../stores/ProjectStore';

const colorMap = {
  active: 'success',
  paused: 'warning',
  onhold: 'warning',
  inactive: 'error',
  completed: 'info',
  archived: 'default'
};

const ProjectList = observer(({isArchive=false}) => {
  const { t } = useTranslation();
  // const { projects, fetchProjects, changeProjectState } = projectStore;

  useEffect(() => {
    projectStore.fetchProjects();
  }, []);

  const [editingProject, setEditingProject] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedManagerProject, setSelectedManagerProject] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);

  const handleEditClick = (project) => {
    setEditingProject(project);
    setFormOpen(true);
  };

  const handleStateClick = (event, project) => {
    setAnchorEl(event.currentTarget);
    setSelectedProject(project);
  };

  const handlePausePlayClick = (project) => {
    const newState = project.state === 'paused' ? 'active' : 'paused';
    projectStore.changeProjectState(project.id, newState);
  };

  const handleStateClose = () => {
    setAnchorEl(null);
    setSelectedProject(null);
  };

  const handleChangeState = async (newState) => {
    if (!selectedProject) return;
    await projectStore.changeProjectState(selectedProject.id, newState);
    handleStateClose();
  };

  const handleDeleteClick = (project) => {
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;

    try {
      await projectStore.deleteProject(projectToDelete.id);
    } catch (err) {
      console.error('Erro ao apagar projeto:', err);
    }

    setDeleteDialogOpen(false);
    setProjectToDelete(null);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setProjectToDelete(null);
  };


  return (
    <Box>
      <Typography variant="h6" sx={{ mt: 2, mb: 2 }}>
        {projectStore.projects.length === 0 ? t('pages.projects.noProjects') : t('pages.projects.projects')}
      </Typography>

      <List sx={{ pb: 12 }}>
        {projectStore.projects.filter(p => isArchive ? p.state==='archived' : p.state!=='archived').map((p) => (
          <ListItem
            key={p.id}
            divider
            sx={{
              backgroundColor: '#f9f9f9',
              borderRadius: 2,
              mb: 1,
              px: 2,
            }}
            secondaryAction={
              <Stack direction="row" spacing={1}>
                {['active', 'paused'].includes(p.state) && (
                  <Tooltip title={t('pages.projects.activatePause')}>
                    <IconButton size="small" onClick={() => handlePausePlayClick(p)}>
                      {p.state === 'paused' ? <PlayArrowIcon /> : <PauseIcon />}
                    </IconButton>
                  </Tooltip>
                )}

                <Tooltip title={t('pages.projects.changeState')}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={(e) => handleStateClick(e, p)}
                    sx={{
                      textTransform: 'capitalize',
                      backgroundColor: (theme) => theme.palette[colorMap[p.state]]?.main || undefined,
                      color: (theme) => theme.palette[colorMap[p.state]]?.contrastText || undefined,
                      '&:hover': {
                        backgroundColor: (theme) => theme.palette[colorMap[p.state]]?.dark || undefined,
                      },
                    }}
                  >
                    {p.state}
                  </Button>
                </Tooltip>

                {!isArchive && (
                   <Tooltip title={t('pages.projects.editProject')}>
                     <IconButton size="small" onClick={() => handleEditClick(p)}>
                       <EditIcon sx={{ color: "primary.main" }} />
                     </IconButton>
                   </Tooltip>
                 )}

                 {!isArchive && (
                    <Tooltip title={t('pages.projects.showTaskTree')}>
                      <IconButton size="small" onClick={() => setSelectedManagerProject(p)}>
                        <AccountTreeIcon sx={{ color: "primary.main" }} />
                      </IconButton>
                    </Tooltip>
                  )}

                {isArchive && (
                  <Tooltip title={t('pages.projects.deleteProjectPermanently')}>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteClick(p)}
                      sx={{ color: 'error.main' }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            }
          >
            <Stack direction="row" alignItems="center" spacing={2} width="100%">
              <Typography variant="subtitle1">{p.name}</Typography>
            </Stack>
          </ListItem>
        ))}
      </List>

      <ProjectForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingProject(null);
          projectStore.fetchProjects();
        }}
        project={editingProject}
      />

      <ProjectManagerDialog
        open={!!selectedManagerProject}
        project={selectedManagerProject}
        onClose={() => setSelectedManagerProject(null)}
      />

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleStateClose}>
        {['active', 'paused', 'inactive', 'completed', 'archived'].map((state) => (
          <MenuItem
            key={state}
            selected={selectedProject?.state === state}
            onClick={() => handleChangeState(state)}
          >
            {t(`pages.projects.states.${state}`)}
          </MenuItem>
        ))}
      </Menu>

      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          {t('pages.projects.deleteDialogTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            {t('pages.projects.deleteDialogText', { projectName: projectToDelete?.name })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="primary">
            {t('pages.projects.cancel')}
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            {t('pages.projects.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {!isArchive && (
        <Fab
          color="primary"
          aria-label="add"
          onClick={() => handleEditClick(null)}
          sx={{ position: 'fixed', bottom: 32, right: 32 }}
        >
          <AddIcon />
        </Fab>
      )}
    </Box>
  );
});

export default ProjectList;
