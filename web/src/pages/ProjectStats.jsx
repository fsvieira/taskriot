import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
  Select,
  MenuItem,
  Chip,
  Tabs,
  Tab,
} from '@mui/material';
import {
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceArea,
} from 'recharts';
import { projectStore } from '../stores/ProjectStore';
import dayjs from 'dayjs';
import HabitsHeatmap from '../components/HabitsHeatmap';
import TaskCyclesWidget from '../components/TaskCyclesWidget';
import TaskIncidenceBarChart from '../components/TaskIncidenceBarChart';


const apiUrl = import.meta.env.VITE_API_URL;
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#FF5733', '#C70039', '#900C3F', '#581845'];

function gerarRelatorio(varTempo, varTarefas, t) {
  // --- 1. Avaliar estabilidade geral
  const estabilidadeGeral = (varTempo + varTarefas) / 2;
  let nivel, descricaoNivel, nivelRelatorio;
  if (estabilidadeGeral < 40) {
    nivel = t('stats.reports.lowStability');
    descricaoNivel = t('stats.reports.significantVariation');
    nivelRelatorio = t('stats.reports.lowStabilityTitle');
  } else if (estabilidadeGeral < 70) {
    nivel = t('stats.reports.moderateStability');
    descricaoNivel = t('stats.reports.occasionalFluctuations');
    nivelRelatorio = t('stats.reports.moderateStabilityTitle');
  } else {
    nivel = t('stats.reports.highStability');
    descricaoNivel = t('stats.reports.consistentBehavior');
    nivelRelatorio = t('stats.reports.highStabilityTitle');
  }

  // --- 2. Análise comparativa entre tempo e tarefas
  let relacao, foco;
  if (Math.abs(varTempo - varTarefas) < 10) {
    relacao = t('stats.reports.similarStability');
    foco = t('stats.reports.maintainBalance');
  } else if (varTempo > varTarefas) {
    relacao = t('stats.reports.timeMoreStable');
    foco = t('stats.reports.reviewPlanning');
  } else {
    relacao = t('stats.reports.tasksMoreStable');
    foco = t('stats.reports.defineWorkBlocks');
  }

  // --- 3. Gerar frase resumo numérica
  const resumoNumerico = t('stats.reports.userStability', {
    timeStability: varTempo.toFixed(0),
    tasksStability: varTarefas.toFixed(0),
    level: nivel
  });

  // --- 4. Mensagem final composta
  const mensagemFinal = t('stats.reports.finalMessage', {
    summary: resumoNumerico,
    description: descricaoNivel,
    relation: relacao,
    focus: foco
  });

  return {nivel, mensagemFinal, nivelRelatorio};
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip" style={{ backgroundColor: '#fff', padding: '10px', border: '1px solid #ccc' }}>
        <p className="label">{`${label}`}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{`${p.name}: ${p.value}`}</p>
        ))}
      </div>
    );
  }

  return null;
};

const formatDuration = (startTime, endTime) => {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM + 10; // add 10 min because endTime is the start of the last bar
  let durationMin = endMin - startMin;
  if (durationMin < 0) durationMin += 24 * 60; // in case crosses midnight, but unlikely
  const hours = Math.floor(durationMin / 60);
  const minutes = durationMin % 60;
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
  } else {
    return `${minutes}min`;
  }
};

export default function ProjectStats() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [habitsRange, setHabitsRange] = useState('week'); // separate range for habits chart
  const [kpiRange, setKpiRange] = useState('week');
  const [timeRange, setTimeRange] = useState('week');
  const [dailyRange, setDailyRange] = useState('week');
  const [kpis, setKpis] = useState(null);
  const [dailyTime, setDailyTime] = useState([]);
  const [habitsData, setHabitsData] = useState([]);
  const [timeByProject, setTimeByProject] = useState([]);
  const [weeklyOpenClosed, setWeeklyOpenClosed] = useState([]);
  const [weeklyProjectId, setWeeklyProjectId] = useState('');
  const [visibleLines, setVisibleLines] = useState({
    abertas: true,
    fechadasAcum: true,
    fechadasSemanal: true,
    criadas: true,
    referencia: true,
    tempo: true,
    media: true,
    idealTime: true,
    avgTimePerWeek: true,
    avgClosedPerWeek: true,
    movingAverage: true,
    normalAverage: true,
    cycles: true
  });
  const [taskIncidenceData, setTaskIncidenceData] = useState([]);
  const [taskIncidenceDay, setTaskIncidenceDay] = useState(1); // Monday
  const [taskIncidenceCycles, setTaskIncidenceCycles] = useState([]);
  const [selectedYear, setSelectedYear] = useState(dayjs().year());
  const [activeTab, setActiveTab] = useState('stats');

  useEffect(() => {
    const loadInitial = async () => {
      setLoading(true);
      await projectStore.fetchProjects();
      await projectStore.fetchQueue();
      await Promise.all([
        fetchKpis(kpiRange),
        fetchDailyTime(dailyRange),
        fetchHabitsData(habitsRange),
        fetchTimeByProject(timeRange),
        fetchWeeklyOpenClosed(),
        fetchTaskIncidenceData(taskIncidenceDay, selectedYear),
      ]);
      setLoading(false);
    };
    loadInitial();
  }, []); // Initial load only

  // Separate effects for each card's range change
  useEffect(() => {
    fetchKpis(kpiRange);
  }, [kpiRange]);

  useEffect(() => {
    fetchTimeByProject(timeRange);
  }, [timeRange, selectedYear]);

  useEffect(() => {
    fetchDailyTime(dailyRange);
  }, [dailyRange]);

  useEffect(() => {
    fetchHabitsData(habitsRange);
  }, [habitsRange]);

  useEffect(() => {
    // Refetch open vs closed when project filter changes
    fetchWeeklyOpenClosed(weeklyProjectId || undefined);
  }, [weeklyProjectId]);

  useEffect(() => {
    fetchTaskIncidenceData(taskIncidenceDay, selectedYear);
  }, [taskIncidenceDay, selectedYear]);

  const daysByRange = { day: 1, week: 7, month: 30, year: 365 };

  const fetchKpis = async (r) => {
    try {
      const res = await fetch(`${apiUrl}/api/project_stats/kpis?range=${r}`);
      const data = await res.json();
      setKpis(data);
    } catch (err) {
      console.error('Erro ao buscar KPIs:', err);
    }
  };

  const fetchDailyTime = async (r) => {
    try {
      const days = daysByRange[r] || 30;
      const res = await fetch(`${apiUrl}/api/project_stats/daily-time?days=${days}`);
      const data = await res.json();
      const processed = data.map(d => ({
        date: dayjs(d.date).format('DD/MM'),
        minutes: Math.round(d.hours * 60),
      }));
      setDailyTime(processed);
    } catch (err) {
      console.error('Erro ao buscar tempo diário:', err);
    }
  };

  const fetchHabitsData = async (r) => {
    try {
      const res = await fetch(`${apiUrl}/api/project_stats/habits?range=${r}`);
      const data = await res.json();
      setHabitsData(data);
    } catch (err) {
      console.error('Erro ao buscar dados de hábitos:', err);
    }
  };

  const fetchTimeByProject = async (r) => {
    try {
      const res = await fetch(`${apiUrl}/api/project_stats/time-by-project?range=${r}&year=${selectedYear}`);
      const data = await res.json();
      setTimeByProject(data);
    } catch (err) {
      console.error('Erro ao buscar tempo por projeto:', err);
    }
  };

  const fetchWeeklyOpenClosed = async (projectId) => {
    try {
      const query = projectId ? `?projectId=${projectId}` : '';
      const res = await fetch(`${apiUrl}/api/project_stats/open-closed-weekly${query}`);
      const data = await res.json();
      setWeeklyOpenClosed(data);
    } catch (err) {
      console.error('Erro ao buscar abertas vs fechadas (semanal):', err);
    }
  };

  const fetchTaskIncidenceData = async (day, year = dayjs().year()) => {
    try {
      console.log('Fetching task incidence for day', day, 'year', year);
      const res = await fetch(`${apiUrl}/api/project_stats/task-incidence-by-time?dayOfWeek=${day}&year=${year}`);
      const { data, cycles } = await res.json();
      console.log('Fetched data length', data.length, 'cycles length', cycles.length);
      console.log('Cycles:', cycles);
      setTaskIncidenceData(data);
      setTaskIncidenceCycles(cycles);
    } catch (err) {
      console.error('Erro ao buscar incidência de tarefas por tempo:', err);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
      </Box>
    );
  }

  // Project states pie chart data
  const stateData = ['active', 'paused', 'inactive', 'completed', 'archived']
    .map(state => ({
      name: t(`pages.projects.states.${state}`),
      value: projectStore.projects.filter(p => p.state === state).length,
    }))
    .filter(d => d.value > 0);

  // Time by project data from API
  const timeData = timeByProject;

  // Calculate global average time per task
  const totalTime = weeklyOpenClosed.reduce((sum, item) => sum + item.time, 0);
  const totalClosed = weeklyOpenClosed.length > 0 ? weeklyOpenClosed[weeklyOpenClosed.length - 1].closed : 0;
  const globalAvgTimePerTask = totalClosed > 0 ? totalTime / totalClosed : 0; // now in hours

  // Calculate averages for horizontal lines
  const numWeeks = weeklyOpenClosed.length;
  const avgTimePerWeek = numWeeks > 0 ? Math.ceil(totalTime / numWeeks) : 0;
  const avgClosedPerWeek = numWeeks > 0 ? Math.ceil(totalClosed / numWeeks) : 0;

  // Prepare chart data with reference line interpolated and weekly closed
  const chartData = weeklyOpenClosed.map((item, index) => {
    const n = weeklyOpenClosed.length;
    const reference = n > 1 ? (index / (n - 1)) * weeklyOpenClosed[n - 1].created : 0;
    const weeklyClosed = index === 0 ? item.closed : item.closed - weeklyOpenClosed[index - 1].closed;
    const average = n > 0 ? weeklyOpenClosed[n - 1].created / n : 0;
    const idealTime = average * globalAvgTimePerTask;
    return { ...item, reference, weeklyClosed, average, idealTime };
  });

  // Calculate time variation report
  const timeVariationCount = weeklyOpenClosed.filter(item => {
    const lowerBound = avgTimePerWeek * 0.9;
    const upperBound = avgTimePerWeek * 1.1;
    return item.time >= lowerBound && item.time <= upperBound;
  }).length;
  const timeVariationPercentage = numWeeks > 0 ? Math.round((timeVariationCount / numWeeks) * 100) : 0;

  // Calculate closed tasks variation report
  const closedVariationCount = chartData.filter(item => {
    const lowerBound = avgClosedPerWeek * 0.9;
    const upperBound = avgClosedPerWeek * 1.1;
    return item.weeklyClosed >= lowerBound && item.weeklyClosed <= upperBound;
  }).length;
  const closedVariationPercentage = numWeeks > 0 ? Math.round((closedVariationCount / numWeeks) * 100) : 0;

  const finalReport = gerarRelatorio(timeVariationPercentage, closedVariationPercentage, t);

  // Use rankings from backend
  const rankedProjects = projectStore.queue.slice().sort((a, b) => a.final_rank - b.final_rank);

  // Compute available years for filter
  const projectYears = projectStore.projects.map(p => dayjs(p.created_at).year()).filter(y => !isNaN(y));
  const minYear = projectYears.length > 0 ? Math.min(...projectYears) : dayjs().year();
  const maxYear = projectYears.length > 0 ? Math.max(...projectYears) : dayjs().year();
  const currentYear = dayjs().year();
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);
  if (!years.includes(currentYear)) years.push(currentYear);
  years.sort((a, b) => a - b);

  const habitsHeatmapData = habitsData ? habitsData.map(habit => {
    if (habitsRange === 'day') {
      // Para dia, habit tem {habit: "name", hours: [0, 0, ..., percentage, ...]}
      return { name: habit.habit, values: habit.hours };
    } else if (habitsRange === 'week') {
      // Para semana, habit tem {habit: "name", days: [0, 0, ..., percentage, ...]}
      return { name: habit.habit, values: habit.days };
    } else if (habitsRange === 'month') {
      // Para mês, habit tem {habit: "name", weeks: [0, 0, ..., percentage, ...]}
      return { name: habit.habit, values: habit.weeks };
    } else if (habitsRange === 'year') {
      // Para ano, habit tem {habit: "name", months: [0, 0, ..., percentage, ...]}
      return { name: habit.habit, values: habit.months };
    } else {
      // Para outros períodos, uma única percentagem
      return { name: habit.title, percentage: habit.percentage };
    }
  }) : [];




  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>{t('pages.stats.title')}</Typography>
      
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="h6">{t('pages.stats.yearFilter')}</Typography>
        <Select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} size="small" sx={{ minWidth: 100 }}>
          {years.map(year => (
            <MenuItem key={year} value={year}>{year}</MenuItem>
          ))}
        </Select>
      </Box>

      <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 2 }}>
        <Tab label={t('pages.stats.statsTab')} value="stats" />
        <Tab label={t('pages.stats.experimentalTab')} value="experimental" />
      </Tabs>

      {activeTab === 'stats' && (
        <Stack spacing={3}>
          {/* Time by Project Pie Chart */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">{t('pages.stats.timeByProject')}</Typography>
                <ToggleButtonGroup
                  value={timeRange}
                  exclusive
                  onChange={(e, val) => { if (val) setTimeRange(val); }}
                  size="small"
                >
                  <ToggleButton value="day">{t('pages.stats.day')}</ToggleButton>
                  <ToggleButton value="week">{t('pages.stats.week')}</ToggleButton>
                  <ToggleButton value="month">{t('pages.stats.month')}</ToggleButton>
                  <ToggleButton value="year">{t('pages.stats.year')}</ToggleButton>
                </ToggleButtonGroup>
              </Box>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={timeData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="hours"
                  >
                    {timeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value}h`, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Stack>
      )}

      {activeTab === 'experimental' && (
        <Stack spacing={3}>
          {/* Habits Chart Card */}
          <Card sx={{ mb: 3, width: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">{t('pages.stats.habitsFrequency')}</Typography>
                <ToggleButtonGroup
                  value={habitsRange}
                  exclusive
                  onChange={(e, val) => { if (val) setHabitsRange(val); }}
                  size="small"
                >
                  <ToggleButton value="day">{t('pages.stats.day')}</ToggleButton>
                  <ToggleButton value="week">{t('pages.stats.week')}</ToggleButton>
                  <ToggleButton value="month">{t('pages.stats.month')}</ToggleButton>
                  <ToggleButton value="year">{t('pages.stats.year')}</ToggleButton>
                </ToggleButtonGroup>
              </Box>
              <HabitsHeatmap habits={habitsHeatmapData} period={habitsRange} />
            </CardContent>
          </Card>

          {/* KPI Cards */}
          {kpis && (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">{t('pages.stats.kpis')}</Typography>
                <ToggleButtonGroup
                  value={kpiRange}
                  exclusive
                  onChange={(e, val) => { if (val) setKpiRange(val); }}
                  size="small"
                >
                  <ToggleButton value="day">{t('pages.stats.day')}</ToggleButton>
                  <ToggleButton value="week">{t('pages.stats.week')}</ToggleButton>
                  <ToggleButton value="month">{t('pages.stats.month')}</ToggleButton>
                  <ToggleButton value="year">{t('pages.stats.year')}</ToggleButton>
                </ToggleButtonGroup>
              </Box>
              <Stack direction="row" spacing={2} sx={{ mb: 3, flexWrap: 'wrap' }}>
              <Card sx={{ minWidth: 200 }}>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">{t('pages.stats.activeProjects')}</Typography>
                  <Typography variant="h5">{kpis.activeProjects}</Typography>
                  <Typography variant="caption" color="text.secondary">{t('pages.stats.ofTotalProjects', { totalProjects: kpis.totalProjects })}</Typography>
                </CardContent>
              </Card>
              <Card sx={{ minWidth: 200 }}>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">{t('pages.stats.focusTime')}</Typography>
                  <Typography variant="h5">
                    {Math.floor((kpis.focusMinutes || 0) / 60)}h {(kpis.focusMinutes || 0) % 60}m
                  </Typography>
                  <Typography variant="caption" color="text.secondary">{t('pages.stats.inSelectedPeriod')}</Typography>
                </CardContent>
              </Card>
              <Card sx={{ minWidth: 200 }}>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">{t('pages.stats.completedTasks')}</Typography>
                  <Typography variant="h5">{kpis.tasksCompleted}</Typography>
                  <Typography variant="caption" color="text.secondary">{t('pages.stats.inSelectedPeriod')}</Typography>
                </CardContent>
              </Card>
              <Card sx={{ minWidth: 200 }}>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">{t('pages.stats.habitsSuccess')}</Typography>
                  <Typography variant="h5">{kpis.habitsSuccessRate}%</Typography>
                  <Typography variant="caption" color="text.secondary">{t('pages.stats.daysWithGoalAchieved')}</Typography>
                </CardContent>
              </Card>
              </Stack>
            </>
          )}

          {/* Project Ranking Table */}
          {rankedProjects.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Ordenação dos Projetos na Queue
                </Typography>
                <Typography variant="body2" sx={{ mb: 2, color: "text.secondary" }}>
                  {`Ordem baseada em rank_avg (8 indicadores) * ${projectStore.queue.ranking_weights?.rank_avg || 0.5} + ES Rank * ${projectStore.queue.ranking_weights?.emotional || 0.5} (menor valor = melhor rank).`}
                </Typography>
                <Box component="table" sx={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", fontWeight: "bold" }}>Projeto</th>
                      <th style={{ textAlign: "center", fontWeight: "bold" }}>Rank Final</th>
                      <th style={{ textAlign: "center", fontWeight: "bold" }}>Perc. Global</th>
                      <th style={{ textAlign: "center", fontWeight: "bold" }}>Perc. Hoje</th>
                      <th style={{ textAlign: "center", fontWeight: "bold" }}>Perc. Semana</th>
                      <th style={{ textAlign: "center", fontWeight: "bold" }}>Perc. Mês</th>
                      <th style={{ textAlign: "center", fontWeight: "bold" }}>Tempo Hoje</th>
                      <th style={{ textAlign: "center", fontWeight: "bold" }}>Tempo Semana</th>
                      <th style={{ textAlign: "center", fontWeight: "bold" }}>Tempo Mês</th>
                      <th style={{ textAlign: "center", fontWeight: "bold" }}>Tempo Total</th>
                      <th style={{ textAlign: "center", fontWeight: "bold" }}>Emotional Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankedProjects.map((project, index) => (
                      <tr key={project.id}>
                        <td>{project.name}</td>
                        <td style={{ textAlign: "center", fontWeight: "bold" }}>{project.final_rank?.toFixed(2)}</td>
                        <td style={{ textAlign: "center" }}>{project.perc_global_rank}</td>
                        <td style={{ textAlign: "center" }}>{project.perc_today_rank}</td>
                        <td style={{ textAlign: "center" }}>{project.perc_week_rank}</td>
                        <td style={{ textAlign: "center" }}>{project.perc_month_rank}</td>
                        <td style={{ textAlign: "center" }}>{project.time_today_rank}</td>
                        <td style={{ textAlign: "center" }}>{project.time_week_rank}</td>
                        <td style={{ textAlign: "center" }}>{project.time_month_rank}</td>
                        <td style={{ textAlign: "center" }}>{project.time_total_rank}</td>
                        <td style={{ textAlign: "center" }}>{project.emotional_score_rank}</td>
                      </tr>
                    ))}
                  </tbody>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Simplified Weekly Chart */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">{t('pages.stats.openClosedWeeklyAndTime')}</Typography>
                <Select
                  value={weeklyProjectId}
                  onChange={(e) => setWeeklyProjectId(e.target.value)}
                  displayEmpty
                  size="small"
                  sx={{ minWidth: 220 }}
                >
                  <MenuItem value="">
                    {t('pages.stats.allProjects')}
                  </MenuItem>
                  {projectStore.projects.map((p) => (
                    <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                  ))}
                </Select>
              </Box>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis yAxisId="left" allowDecimals={false} label={{ value: 'Tarefas', angle: -90, position: 'insideLeft' }} />
                  <YAxis yAxisId="right" orientation="right" allowDecimals={false} label={{ value: 'Horas', angle: 90, position: 'insideRight' }} />
                  <Tooltip formatter={(value, name) => {
                    if (name === 'Tempo (h)' || name === 'Tempo Ideal/tarefa (h)') {
                      const totalMinutes = Math.round(value * 60);
                      const days = Math.floor(totalMinutes / (24 * 60));
                      const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
                      const minutes = totalMinutes % 60;

                      let formatted = '';
                      if (days > 0) formatted += `${days}d `;
                      if (hours > 0) formatted += `${hours}h `;
                      if (minutes > 0 || formatted === '') formatted += `${minutes}m`;

                      return [formatted.trim(), name];
                    }
                    return [value, name];
                  }} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" name={t('pages.stats.open')} dataKey="open" stroke="#1976d2" strokeWidth={2} dot={false} />
                  <Line yAxisId="left" type="monotone" name={t('pages.stats.closedWeekly')} dataKey="weeklyClosed" stroke="#ff5722" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" name={t('pages.stats.timeH')} dataKey="time" stroke="#ff9800" strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" name={t('pages.stats.averageTimePerWeekH')} dataKey={() => avgTimePerWeek} stroke="#8bc34a" strokeWidth={2} strokeDasharray="20 5" dot={false} />
                  <Line yAxisId="left" type="monotone" name={t('pages.stats.averageClosedPerWeek')} dataKey={() => avgClosedPerWeek} stroke="#e91e63" strokeWidth={2} strokeDasharray="20 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <Box sx={{ mt: 2, p: 2, bgcolor: finalReport.nivelRelatorio === 'Baixa Estabilidade' ? '#ffebee' : finalReport.nivelRelatorio === 'Estabilidade Moderada' ? '#fff3e0' : '#e8f5e8', borderRadius: 1, border: 1, borderColor: 'divider' }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  {finalReport.nivelRelatorio}
                </Typography>
                <Typography variant="body2">
                  {finalReport.mensagemFinal}
                </Typography>
              </Box>
            </CardContent>
          </Card>

          {/* Project States Pie Chart */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('pages.stats.projectStatesDistribution')}
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stateData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {stateData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => {
                    if (name === 'Tempo (h)' || name === 'Tempo Ideal/tarefa (h)') {
                      const totalMinutes = value;
                      const days = Math.floor(totalMinutes / (24 * 60));
                      const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
                      const minutes = totalMinutes % 60;

                      let formatted = '';
                      if (days > 0) formatted += `${days}d `;
                      if (hours > 0) formatted += `${hours}h `;
                      if (minutes > 0 || formatted === '') formatted += `${minutes}m`;

                      return [formatted.trim(), name];
                    }
                    return [value, name];
                  }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Daily Time Line Chart */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">{t('pages.stats.dailyTime', { range: dailyRange })}</Typography>
                <ToggleButtonGroup
                  value={dailyRange}
                  exclusive
                  onChange={(e, val) => { if (val) setDailyRange(val); }}
                  size="small"
                >
                  <ToggleButton value="day">{t('pages.stats.day')}</ToggleButton>
                  <ToggleButton value="week">{t('pages.stats.week')}</ToggleButton>
                  <ToggleButton value="month">{t('pages.stats.month')}</ToggleButton>
                  <ToggleButton value="year">{t('pages.stats.year')}</ToggleButton>
                </ToggleButtonGroup>
              </Box>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis label={{ value: 'Minutos', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(value) => {
                    const totalMinutes = value;
                    const days = Math.floor(totalMinutes / (24 * 60));
                    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
                    const minutes = totalMinutes % 60;

                    let formatted = '';
                    if (days > 0) formatted += `${days}d `;
                    if (hours > 0) formatted += `${hours}h `;
                    if (minutes > 0 || formatted === '') formatted += `${minutes}m`;

                    return [formatted.trim(), 'Foco'];
                  }} />
                  <Line type="monotone" dataKey="minutes" stroke="#8884d8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Task Incidence by Time Chart */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">{t('pages.stats.taskIncidenceByTime')}</Typography>
                <Select
                  value={taskIncidenceDay}
                  onChange={(e) => setTaskIncidenceDay(e.target.value)}
                  size="small"
                  sx={{ minWidth: 150 }}
                >
                  <MenuItem value={0}>{t('pages.stats.sunday')}</MenuItem>
                  <MenuItem value={1}>{t('pages.stats.monday')}</MenuItem>
                  <MenuItem value={2}>{t('pages.stats.tuesday')}</MenuItem>
                  <MenuItem value={3}>{t('pages.stats.wednesday')}</MenuItem>
                  <MenuItem value={4}>{t('pages.stats.thursday')}</MenuItem>
                  <MenuItem value={5}>{t('pages.stats.friday')}</MenuItem>
                  <MenuItem value={6}>{t('pages.stats.saturday')}</MenuItem>
                </Select>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {Object.entries({
                  movingAverage: t('pages.stats.movingAverage'),
                  normalAverage: t('pages.stats.normalAverage'),
                  cycles: t('pages.stats.cycles'),
                }).map(([key, label]) => (
                  <ToggleButton
                    key={key}
                    value={key}
                    selected={visibleLines[key]}
                    onChange={() => setVisibleLines(prev => ({ ...prev, [key]: !prev[key] }))}
                    size="small"
                    sx={{ fontSize: '0.75rem', padding: '4px 8px' }}
                  >
                    {label}
                  </ToggleButton>
                ))}
              </Box>
              {(() => {
                console.log('visibleLines.cycles', visibleLines.cycles);
                console.log('taskIncidenceCycles', taskIncidenceCycles);
                // Trim leading and trailing empty data
                const startIndex = taskIncidenceData.findIndex(d => d.count > 0);
                const endIndex = taskIncidenceData.length - 1 - taskIncidenceData.slice().reverse().findIndex(d => d.count > 0);
                const trimmedData = startIndex !== -1 ? taskIncidenceData.slice(startIndex, endIndex + 1) : [];
                const minTime = trimmedData.length > 0 ? trimmedData[0].time : 0;
                const maxTime = trimmedData.length > 0 ? trimmedData[trimmedData.length - 1].time : 24;

                // Calculate averages
                const totalCount = trimmedData.reduce((sum, d) => sum + d.count, 0);
                const normalAverage = trimmedData.length > 0 ? totalCount / trimmedData.length : 0;
                const windowSize = 6; // 1 hour
                const movingAverage = trimmedData.map((d, i) => {
                  const start = Math.max(0, i - Math.floor(windowSize / 2));
                  const end = Math.min(trimmedData.length - 1, i + Math.floor(windowSize / 2));
                  const sum = trimmedData.slice(start, end + 1).reduce((s, dd) => s + dd.count, 0);
                  return sum / (end - start + 1);
                });
                const dataWithAverages = trimmedData.map((d, i) => ({
                  ...d,
                  percentage: totalCount > 0 ? (d.count / totalCount) * 100 : 0,
                  movingAveragePerc: totalCount > 0 ? (movingAverage[i] / totalCount) * 100 : 0,
                  normalAveragePerc: totalCount > 0 ? (normalAverage / totalCount) * 100 : 0,
                  dummy: 0
                }));

                return (
                  <>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dataWithAverages}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" domain={[minTime, maxTime]} />
                      <YAxis yAxisId="left" label={{ value: t('pages.stats.percentage'), angle: -90, position: 'insideLeft' }} />
                      <Tooltip formatter={(value, name, props) => {
                        if (name === t('pages.stats.incidence')) {
                          return [
                            `${value.toFixed(1)}%`,
                            props.payload.emotionalAverage ?
                              `${t('pages.stats.incidence')} (Sentimento: ${props.payload.emotionalAverage === 1 ? 'Baixo' : props.payload.emotionalAverage === 2 ? 'Médio' : 'Alto'})` :
                              t('pages.stats.incidence')
                          ];
                        }
                        return [value, name];
                      }} />
                      <Legend />
                      {visibleLines.cycles && taskIncidenceCycles?.map((cycle, index) => (
                        <ReferenceArea
                          key={`cycle-${index}`}
                          yAxisId="left"
                          x1={cycle.start}
                          x2={cycle.end}
                          y1={5} y2={25}
                          stroke="red"
                          strokeWidth={3}
                          fill="red"
                          fillOpacity={0.5}
                          label={{ value: `C${index + 1}`, position: 'insideTop', fill: '#000' }}
                        />
                      ))}
                      <Bar
                        yAxisId="left"
                        dataKey="percentage"
                        name={t('pages.stats.incidence')}
                        shape={(props) => {
                          const { x, y, width, height, index } = props;
                          const item = dataWithAverages[index];
                          if (!item) return null;
                          
                          const EMOTIONAL_COLORS = {
                            1: '#ff5252', // Red (low)
                            2: '#ffc107', // Orange (medium)
                            3: '#4caf50', // Green (high)
                          };
                          
                          const color = item.emotionalAverage ? EMOTIONAL_COLORS[item.emotionalAverage] || '#8884d8' : '#8884d8';
                          return (
                            <rect
                              x={x}
                              y={y}
                              width={width}
                              height={height}
                              fill={color}
                              stroke="rgba(0,0,0,0.1)"
                              strokeWidth={1}
                            />
                          );
                        }}
                        radius={[4, 4, 0, 0]}
                      />
                      {visibleLines.movingAverage && <Line yAxisId="left" type="monotone" dataKey="movingAveragePerc" stroke="#ff5722" strokeWidth={2} dot={false} name={t('pages.stats.movingAverage')} />}
                      {visibleLines.normalAverage && <Line yAxisId="left" type="monotone" dataKey="normalAveragePerc" stroke="#4caf50" strokeWidth={2} strokeDasharray="5 5" dot={false} name={t('pages.stats.normalAverage')} />}
                    </BarChart>
                  </ResponsiveContainer>
                  <TaskCyclesWidget dayOfWeek={taskIncidenceDay} year={selectedYear} cycles={taskIncidenceCycles} />
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                    {[
                      { label: 'Baixo (1)', color: '#ff5252' },
                      { label: 'Médio (2)', color: '#ffc107' },
                      { label: 'Alto (3)', color: '#4caf50' }
                    ].map(({ label, color }) => (
                      <Chip
                        key={label}
                        label={label}
                        style={{ backgroundColor: color, color: '#fff' }}
                      />
                    ))}
                  </Box>
                  </>
                );
              })()}
            </CardContent>
          </Card>

          {/* Task Incidence Bar Chart (New Visualization) */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">{t('pages.stats.taskIncidenceByHourSimplified')}</Typography>
                <Select
                  value={taskIncidenceDay}
                  onChange={(e) => setTaskIncidenceDay(e.target.value)}
                  size="small"
                  sx={{ minWidth: 150 }}
                >
                  <MenuItem value={0}>{t('pages.stats.sunday')}</MenuItem>
                  <MenuItem value={1}>{t('pages.stats.monday')}</MenuItem>
                  <MenuItem value={2}>{t('pages.stats.tuesday')}</MenuItem>
                  <MenuItem value={3}>{t('pages.stats.wednesday')}</MenuItem>
                  <MenuItem value={4}>{t('pages.stats.thursday')}</MenuItem>
                  <MenuItem value={5}>{t('pages.stats.friday')}</MenuItem>
                  <MenuItem value={6}>{t('pages.stats.saturday')}</MenuItem>
                </Select>
              </Box>
              <TaskIncidenceBarChart
                data={taskIncidenceData}
                cycles={taskIncidenceCycles}
                dayOfWeek={taskIncidenceDay}
                year={selectedYear}
                collapsible={false}
              />
            </CardContent>
          </Card>
        </Stack>
      )}
    </Box>
  );
}