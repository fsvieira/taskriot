import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
  Collapse,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import { ExpandMore, ExpandLess } from '@mui/icons-material';
import dayjs from 'dayjs';

const apiUrl = import.meta.env.VITE_API_URL;

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

export default function TaskCyclesWidget({
  cycles: providedCycles,
  dayOfWeek,
  year,
  last30days = false,
  collapsible = false,
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(!collapsible);
  const [cycles, setCycles] = useState(providedCycles || []);
  const [loading, setLoading] = useState(!providedCycles);
  const [currentTime, setCurrentTime] = useState(dayjs().format('HH:mm'));

  const fetchCycles = async () => {
    // Don't fetch if cycles are provided externally
    if (providedCycles) {
      setLoading(false);
      return;
    }

    try {
      let query = '';
      if (last30days) {
        // dayOfWeek will be determined by the backend if not provided
        const dowQuery = dayOfWeek !== undefined ? `&dayOfWeek=${dayOfWeek}` : '';
        query = `?last30days=true${dowQuery}`;
      } else if (dayOfWeek !== undefined && year) {
        query = `?dayOfWeek=${dayOfWeek}&year=${year}`;
      } else {
        // Default to last 30 days for today's day of week
        query = `?last30days=true`;
      }
      
      const res = await fetch(`${apiUrl}/api/project_stats/task-incidence-by-time${query}`);
      const { cycles: fetchedCycles } = await res.json();
      setCycles(fetchedCycles || []);
    } catch (err) {
      console.error('Erro ao buscar ciclos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // If cycles are passed as props, use them directly.
    if (providedCycles) {
      setCycles(providedCycles);
      setLoading(false);
    } else {
      // Otherwise, fetch them.
      setLoading(true);
      fetchCycles();
    }
  }, [providedCycles, dayOfWeek, year, last30days]);


  useEffect(() => {
    // Auto-refresh every 5 minutes ONLY if not using provided cycles
    if (!providedCycles) {
      const interval = setInterval(fetchCycles, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [providedCycles, dayOfWeek, year, last30days]);

  useEffect(() => {
    // Update current time every minute
    const timeInterval = setInterval(() => {
      setCurrentTime(dayjs().format('HH:mm'));
    }, 60 * 1000);
    return () => clearInterval(timeInterval);
  }, []);

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  // Show current time marker only if we are looking at data for today
  const showCurrentTime = last30days || (year === dayjs().year());

  const chartContent = cycles.length > 0 ? (
    (() => {
      // Calculate min and max time from cycles
      const times = cycles.flatMap(c => [c.start, c.end]);
      const sortedTimes = times.sort();
      const minTime = sortedTimes[0];
      const maxTime = sortedTimes[sortedTimes.length - 1];

      // Create data only for the time range
      const data = [];
      for (let i = 0; i < 144; i++) {
        const hours = Math.floor((i * 10) / 60);
        const minutes = (i * 10) % 60;
        const time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        if (time >= minTime && time <= maxTime) {
          data.push({ time, dummy: 0 });
        }
      }

      return (
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <XAxis dataKey="time" tickLine={false} axisLine={false} />
            <YAxis hide domain={[0, 2]} />
            <Bar dataKey="dummy" fill="transparent" />
            {showCurrentTime && <ReferenceLine x={currentTime} stroke="blue" strokeWidth={2} label={{ value: 'Agora', position: 'top' }} />}
            {cycles.map((cycle, index) => (
              <ReferenceArea
                key={`cycle-${index}`}
                x1={cycle.start}
                x2={cycle.end}
                y1={0} y2={2}
                stroke="red"
                strokeWidth={2}
                strokeOpacity={0.8}
                fill="red"
                fillOpacity={0.2}
                label={{ value: formatDuration(cycle.start, cycle.end), position: 'insideTop', fill: '#000' }}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    })()
  ) : (
    <Typography>Ainda sem dados suficientes para calcular ciclos.</Typography>
  );

  if (loading) {
    return collapsible ? (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6">Ciclos de Trabalho Hoje</Typography>
          <Typography>Carregando...</Typography>
        </CardContent>
      </Card>
    ) : (
      <Typography>Carregando...</Typography>
    );
  }

  if (collapsible) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Ciclos de Trabalho Hoje</Typography>
            <IconButton onClick={toggleExpanded}>
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
          <Collapse in={expanded}>
            {chartContent}
          </Collapse>
        </CardContent>
      </Card>
    );
  } else {
    return chartContent;
  }
}