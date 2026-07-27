import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  LinearProgress,
  Paper,
  Stack,
} from '@mui/material';
import { observer } from 'mobx-react-lite';
import { projectStore } from '../../stores/ProjectStore';

// Split months into 3 groups of 4
const MONTH_GROUPS = [
  { label: 'Jan – Abr', months: ['Jan', 'Fev', 'Mar', 'Abr'], startIdx: 0 },
  { label: 'Mai – Ago', months: ['Mai', 'Jun', 'Jul', 'Ago'], startIdx: 4 },
  { label: 'Set – Dez', months: ['Set', 'Out', 'Nov', 'Dez'], startIdx: 8 },
];

const WEEKS = [1, 2, 3, 4];

const CHECKBOX_SIZE = 18;
const CELL_WIDTH = 32;
const MONTH_LABEL_WIDTH = CELL_WIDTH * 4 + 6;
const PROJECT_COL_WIDTH = 300;

// Shared sticky column styles for headers and body cells
const stickyColumnSx = {
  position: 'sticky',
  left: 0,
  bgcolor: 'background.paper',
  width: PROJECT_COL_WIDTH,
  minWidth: PROJECT_COL_WIDTH,
  maxWidth: PROJECT_COL_WIDTH,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const stickyHeaderSx = {
  ...stickyColumnSx,
  zIndex: 10,
  fontWeight: 'bold',
  fontSize: '0.9rem',
  borderRight: '2px solid',
  borderColor: 'divider',
};

const stickyBodySx = {
  ...stickyColumnSx,
  zIndex: 1,
  fontSize: '0.9rem',
  fontWeight: 500,
  borderRight: '2px solid',
  borderColor: 'divider',
};

// Build a key from project + month + week
function cellKey(projectId, monthIdx, week) {
  return `${projectId}-${monthIdx}-${week}`;
}

function MonthTable({ months, startMonthIdx, projects, schedule, onToggle }) {
  return (
    <Box>
      <TableContainer component={Paper} sx={{ maxHeight: 500 }}>
        <Table size="small" stickyHeader sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            {/* Row 1: Month labels spanning 4 weeks each */}
            <TableRow>
              <TableCell sx={stickyHeaderSx}>
                Projecto
              </TableCell>
              {months.map((month, idx) => (
                <TableCell
                  key={month}
                  align="center"
                  colSpan={4}
                  sx={{
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                    width: MONTH_LABEL_WIDTH,
                    minWidth: MONTH_LABEL_WIDTH,
                    maxWidth: MONTH_LABEL_WIDTH,
                    px: 0.5,
                    py: 0.5,
                    borderLeft: idx > 0 ? '2px solid' : 'none',
                    borderColor: 'divider',
                    zIndex: 2,
                  }}
                >
                  {month}
                </TableCell>
              ))}
            </TableRow>

            {/* Row 2: Week numbers (1-4) */}
            <TableRow>
              <TableCell sx={{ ...stickyHeaderSx, zIndex: 11, height: 32 }} />
              {months.map((_, idx) => {
                const globalMonthIdx = startMonthIdx + idx;
                return WEEKS.map((week) => (
                  <TableCell
                    key={`${globalMonthIdx}-${week}`}
                    align="center"
                    sx={{
                      fontSize: '0.7rem',
                      width: CELL_WIDTH,
                      minWidth: CELL_WIDTH,
                      maxWidth: CELL_WIDTH,
                      px: 0,
                      py: 0.5,
                    }}
                  >
                    S{week}
                  </TableCell>
                ));
              })}
            </TableRow>
          </TableHead>

          <TableBody>
            {projects.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={1 + months.length * 4}
                  align="center"
                  sx={{ py: 4, color: 'text.secondary' }}
                >
                  Nenhum projecto disponível.
                </TableCell>
              </TableRow>
            ) : (
              projects.map((project) => (
                <TableRow key={project.id} hover>
                  <TableCell sx={stickyBodySx}>
                    {project.name}
                  </TableCell>
                  {months.map((_, idx) => {
                    const globalMonthIdx = startMonthIdx + idx;
                    return WEEKS.map((week) => {
                      const key = cellKey(project.id, globalMonthIdx, week);
                      const checked = !!schedule[key];
                      return (
                        <TableCell
                          key={key}
                          align="center"
                          sx={{
                            width: CELL_WIDTH,
                            minWidth: CELL_WIDTH,
                            maxWidth: CELL_WIDTH,
                            px: 0,
                            py: 0,
                          }}
                        >
                          <Checkbox
                            checked={checked}
                            onChange={() => onToggle(project.id, globalMonthIdx, week)}
                            size="small"
                            sx={{
                              p: 0,
                              '& .MuiSvgIcon-root': { fontSize: CHECKBOX_SIZE },
                            }}
                          />
                        </TableCell>
                      );
                    });
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

const ProjectScheduler = observer(() => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  // Mock data: { [cellKey]: true/false }
  const [schedule, setSchedule] = useState({});

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        await projectStore.fetchProjects();
      } catch (err) {
        console.error('Erro ao buscar projetos:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    // Filter projects: exclude archived and completed
    const filtered = (projectStore.projects || []).filter(
      (p) => p.state !== 'archived' && p.state !== 'completed'
    );
    setProjects(filtered);
  }, [projectStore.projects]);

  const handleToggle = (projectId, monthIdx, week) => {
    const key = cellKey(projectId, monthIdx, week);
    setSchedule((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (loading) return <LinearProgress />;

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Projectos por Mês/Semana
      </Typography>

      <Stack spacing={3}>
        {MONTH_GROUPS.map((group) => (
          <Box key={group.label}>
            <Typography
              variant="subtitle2"
              sx={{ mb: 1, fontWeight: 'bold', color: 'text.secondary' }}
            >
              {group.label}
            </Typography>
            <MonthTable
              months={group.months}
              startMonthIdx={group.startIdx}
              projects={projects}
              schedule={schedule}
              onToggle={handleToggle}
            />
          </Box>
        ))}
      </Stack>
    </Box>
  );
});

export default ProjectScheduler;