import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  LinearProgress,
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';

const apiUrl = import.meta.env.VITE_API_URL;

export default function LabelsManager() {
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState(null);
  const [labelName, setLabelName] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchLabels = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/labels`);
      const data = await res.json();
      setLabels(data);
    } catch (err) {
      console.error('Erro ao buscar fases:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  const openCreateDialog = () => {
    setEditingLabel(null);
    setLabelName('');
    setDialogOpen(true);
  };

  const openEditDialog = (label) => {
    setEditingLabel(label);
    setLabelName(label.name);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!labelName.trim()) return;
    setSaving(true);
    try {
      if (editingLabel) {
        await fetch(`${apiUrl}/api/labels/${editingLabel.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: labelName.trim() }),
        });
      } else {
        await fetch(`${apiUrl}/api/labels`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: labelName.trim() }),
        });
      }
      setDialogOpen(false);
      fetchLabels();
    } catch (err) {
      console.error('Erro ao guardar fase:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`${apiUrl}/api/labels/${id}`, {
        method: 'DELETE',
      });
      fetchLabels();
    } catch (err) {
      console.error('Erro ao apagar fase:', err);
    }
  };

  if (loading) return <LinearProgress />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Gerir Fases
        </Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<Add />}
          onClick={openCreateDialog}
        >
          Adicionar Fase
        </Button>
      </Box>

      {labels.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 4, textAlign: 'center' }}>
          Ainda não existem fases. Crie a sua primeira fase para começar.
        </Typography>
      ) : (
        <List>
          {labels.map((label) => (
            <ListItem
              key={label.id}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                mb: 1,
              }}
              secondaryAction={
                <Box>
                  <IconButton size="small" onClick={() => openEditDialog(label)}>
                    <Edit fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(label.id)}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Box>
              }
            >
              <ListItemText
                primary={label.name}
              />
            </ListItem>
          ))}
        </List>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {editingLabel ? 'Editar Fase' : 'Nova Fase'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Nome da Fase"
            fullWidth
            size="small"
            value={labelName}
            onChange={(e) => setLabelName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !labelName.trim()}
          >
            {saving ? 'A guardar...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}