import React, { useEffect, useState, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  IconButton,
  Collapse,
  Card,
  CardContent,
} from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';
import dayjs from 'dayjs';

const apiUrl = import.meta.env.VITE_API_URL;

// Colors for emotional averages (1-3 scale)
const EMOTIONAL_COLORS = {
  1: '#ff5252', // Red (low)
  2: '#ffc107', // Orange (medium)
  3: '#4caf50', // Green (high)
};

const formatDuration = (startTime, endTime) => {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;
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

export default function TaskTimelineChart() {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(dayjs());
  const [sequenceData, setSequenceData] = useState([]);

  const fetchData = async () => {
    try {
      const dayOfWeek = dayjs().day(); // 0=Sunday, 1=Monday, etc.
      const year = dayjs().year();
      const res = await fetch(`${apiUrl}/api/project_stats/task-incidence-by-time?dayOfWeek=${dayOfWeek}&year=${year}`);
      const { data: fetchedData, cycles: fetchedCycles } = await res.json();
      setData(fetchedData || []);
      setCycles(fetchedCycles || []);
    } catch (err) {
      console.error('Erro ao buscar dados de incidência:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(dayjs());
    }, 60 * 1000);
    return () => clearInterval(timeInterval);
  }, []);

  useEffect(() => {
    if (cycles.length > 0 && data.length > 0) {
      // Logic to calculate emotional averages for cycles
      const dataMap = new Map(data.map(d => [d.time, d]));

      const chartData = cycles.map(cycle => {
        const [startH, startM] = cycle.start.split(':').map(Number);
        const [endH, endM] = cycle.end.split(':').map(Number);
        const startMin = startH * 60 + startM;
        const endMin = endH * 60 + endM + 10;

        let totalWeight = 0;
        let totalEmotionalValue = 0;

        // Calculate weighted emotional average for all slots in the cycle
        for (let i = startMin; i <= endMin - 10; i += 10) {
          const h = Math.floor(i / 60).toString().padStart(2, '0');
          const m = (i % 60).toString().padStart(2, '0');
          const time = `${h}:${m}`;
          const dataPoint = dataMap.get(time);
          if (dataPoint && dataPoint.emotionalAverage !== null) {
            totalWeight += dataPoint.count;
            totalEmotionalValue += dataPoint.count * dataPoint.emotionalAverage;
          }
        }

        // Calculate final emotional average for the cycle
        let emotionalAverage = null;
        if (totalWeight > 0) {
          emotionalAverage = Math.round(totalEmotionalValue / totalWeight);
        }

        return {
          displayStartTime: cycle.start,
          displayEndTime: dayjs(`2000-01-01 ${cycle.end}`).add(10, 'minute').format('HH:mm'),
          durationMinutes: endMin - startMin,
          emotionalAverage,
        };
      });
      setSequenceData(chartData);
    } else {
      setSequenceData([]);
    }
  }, [data, cycles]);

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  if (loading) {
    return (
      <Typography>Carregando...</Typography>
    );
  }

  if (sequenceData.length === 0) {
    return (
      <Typography>Ainda sem dados suficientes para calcular ciclos.</Typography>
    );
  }

  // Calculate time range with padding
  const allTimes = sequenceData.flatMap(c => [c.displayStartTime, c.displayEndTime]);
  const sortedTimes = allTimes.sort();
  const minTimeStr = sortedTimes[0];
  const maxTimeStr = sortedTimes[sortedTimes.length - 1];

  // Add 1 hour padding
  const minTime = dayjs(`2000-01-01 ${minTimeStr}`).subtract(1, 'hour');
  const maxTime = dayjs(`2000-01-01 ${maxTimeStr}`).add(1, 'hour');

  const totalMinutes = maxTime.diff(minTime, 'minute');

  // Current time position
  const currentTimeObj = dayjs(`2000-01-01 ${currentTime.format('HH:mm')}`);
  const currentMinutes = currentTimeObj.diff(minTime, 'minute');
  const currentPercent = totalMinutes > 0 ? (currentMinutes / totalMinutes) * 100 : 0;
  const showCurrentLine = currentPercent >= 0 && currentPercent <= 100;

  // Calculate remaining time
  let remainingText = '';
  let statusText = '';
  let inCycle = false;
  let nextCycleDuration = '';
  if (sequenceData.length > 0) {
    const sortedCycles = sequenceData.sort((a, b) => a.displayStartTime.localeCompare(b.displayStartTime));
    for (const cycle of sortedCycles) {
      const start = dayjs(`2000-01-01 ${cycle.displayStartTime}`);
      const end = dayjs(`2000-01-01 ${cycle.displayEndTime}`);
      if (currentTimeObj.isAfter(start) && currentTimeObj.isBefore(end)) {
        // In cycle, time to end
        const remainingMin = end.diff(currentTimeObj, 'minute');
        const hours = Math.floor(remainingMin / 60);
        const minutes = remainingMin % 60;
        remainingText = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
        const emoji = cycle.emotionalAverage === 1 ? '😞' : cycle.emotionalAverage === 3 ? '😊' : '😐';
        const color = cycle.emotionalAverage ? EMOTIONAL_COLORS[cycle.emotionalAverage] : '#8884d8';
        statusText = (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <span style={{ fontSize: '1.2em', color }}>{emoji}</span>
            <Typography>Ciclo activo, faltam {remainingText} para o fim</Typography>
          </Box>
        );
        inCycle = true;
        break;
      } else if (currentTimeObj.isBefore(start)) {
        // Before this cycle, time to start
        const remainingMin = start.diff(currentTimeObj, 'minute');
        const hours = Math.floor(remainingMin / 60);
        const minutes = remainingMin % 60;
        remainingText = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
        nextCycleDuration = formatDuration(cycle.displayStartTime, cycle.displayEndTime);
        statusText = `Pausa: próximo ciclo (${nextCycleDuration}) daqui a ${remainingText}`;
        break;
      }
    }
  } else {
    statusText = 'Sem ciclos hoje';
  }

  const chartContent = sequenceData.length > 0 ? (
    <Box sx={{ width: '100%', height: 120, position: 'relative', mt: 2 }}>
      {/* Horizontal timeline line behind boxes */}
      <Box
        sx={{
          position: 'absolute',
          top: 30,
          left: 0,
          right: 0,
          height: 2,
          backgroundColor: '#ccc',
          zIndex: -1,
        }}
      />
      {/* Cycle boxes */}
      {sequenceData.map((cycle, index) => {
        const startTimeObj = dayjs(`2000-01-01 ${cycle.displayStartTime}`);
        const endTimeObj = dayjs(`2000-01-01 ${cycle.displayEndTime}`);
        const startMinutes = startTimeObj.diff(minTime, 'minute');
        const durationMinutes = endTimeObj.diff(startTimeObj, 'minute');
        const leftPercent = totalMinutes > 0 ? (startMinutes / totalMinutes) * 100 : 0;
        const widthPercent = totalMinutes > 0 ? (durationMinutes / totalMinutes) * 100 : 0;

        const color = cycle.emotionalAverage ? EMOTIONAL_COLORS[cycle.emotionalAverage] || '#8884d8' : '#8884d8';

        return (
          <Fragment key={index}>
            {/* Box */}
            <Box
              sx={{
                position: 'absolute',
                top: 10,
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
                height: 40,
                backgroundColor: color,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                boxShadow: 1,
              }}
            >
            </Box>
            {/* Time label below box */}
            <Typography
              sx={{
                position: 'absolute',
                top: 55,
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
                textAlign: 'center',
                fontSize: '0.7rem',
                color: '#666',
                whiteSpace: 'pre-line',
              }}
            >
              {cycle.displayStartTime} — {cycle.displayEndTime}{'\n'}{formatDuration(cycle.displayStartTime, cycle.displayEndTime)}
            </Typography>
          </Fragment>
        );
      })}
      {/* Current time vertical line */}
      {showCurrentLine && remainingText && (
        <Box
          sx={{
            position: 'absolute',
            top: 5,
            left: `${currentPercent}%`,
            width: 4,
            height: 30,
            backgroundColor: 'blue',
            '&::after': {
              content: `"${remainingText}"`,
              position: 'absolute',
              top: -18,
              left: -20,
              fontSize: '0.75rem',
              color: 'blue',
              whiteSpace: 'nowrap',
            },
          }}
        />
      )}
    </Box>
  ) : (
    <Typography>Ainda sem dados suficientes para calcular ciclos.</Typography>
  );

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">{statusText}</Typography>
          <IconButton onClick={toggleExpanded}>
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>
        <Collapse in={expanded}>
          {chartContent}
          {/* Legend */}
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 3, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 16, height: 16, backgroundColor: '#ff5252', borderRadius: 1 }}></Box>
              <Typography variant="body2">😞 Baixo</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 16, height: 16, backgroundColor: '#ffc107', borderRadius: 1 }}></Box>
              <Typography variant="body2">😐 Médio</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 16, height: 16, backgroundColor: '#4caf50', borderRadius: 1 }}></Box>
              <Typography variant="body2">😊 Alto</Typography>
            </Box>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}