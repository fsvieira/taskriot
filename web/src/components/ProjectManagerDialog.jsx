import React from 'react';
import TaskTreeModal from './tasks/TaskTreeModal';

export default function ProjectManagerDialog({ open, onClose, project }) {
  if (!project) return null;

  return (
    <TaskTreeModal
      open={open}
      onClose={onClose}
      project={project}
      title="Gestão de Tarefas"
    />
  );
}
