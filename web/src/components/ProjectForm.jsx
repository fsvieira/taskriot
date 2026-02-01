import React, { useState, useEffect } from "react";
import {
  TextField,
  Button,
  Stack,
  MenuItem,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
} from "@mui/material";
import { projectStore } from "../stores/ProjectStore";

const STATES = ["active", "paused", "inactive", "completed", "archived"];

export default function ProjectForm({ onClose, open, project }) {
  const [name, setName] = useState("");
  const [state, setState] = useState("active");

  useEffect(() => {
    setName(project?.name ?? "");
    setState(project?.state ?? "active");
  }, [project]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      id: project?.id,
      name,
      state,
    };

    await projectStore.saveProject(payload);

    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{project ? "Editar Projeto" : "Novo Projeto"}</DialogTitle>
      <DialogContent>
        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
          <Stack spacing={2}>
            <TextField
              label="Nome do Projeto"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <FormControl fullWidth required>
              <InputLabel>Estado</InputLabel>
              <Select
                value={state}
                label="Estado"
                onChange={(e) => setState(e.target.value)}
              >
                {STATES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <DialogActions>
              <Button onClick={onClose}>Cancelar</Button>
              <Button type="submit" variant="contained">
                Guardar
              </Button>
            </DialogActions>
          </Stack>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
