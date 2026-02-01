import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
  Collapse,
  Chip,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import { ExpandMore, ExpandLess } from '@mui/icons-material';
import dayjs from 'dayjs';

const apiUrl = import.meta.env.VITE_API_URL;

// Colors for emotional averages (1-3 scale)
const EMOTIONAL_COLORS = {
  1: '#ff5252', // Red (low)
  2: '#ffc107', // Orange (medium)
  3: '#4caf50', // Green (high)
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const dataIndex = payload[0].payload;
    return (
      <div className="custom-tooltip" style={{ backgroundColor: '#fff', padding: '10px', border: '1px solid #ccc' }}>
        <p className="label">{`${label}`}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{`${p.name}: ${p.value} min`}</p>
        ))}
        {dataIndex.emotionalAverage && (
          <p>
            {dataIndex.emotionalAverage === 1 ? 'Sentimento: Baixo' : 
             dataIndex.emotionalAverage === 2 ? 'Sentimento: Médio' : 
             'Sentimento: Alto'}
          </p>
        )}
      </div>
    );
  }
  return null;
};

export default function TaskIncidenceBarChart({
  data: providedData,
  cycles: providedCycles,
  dayOfWeek,
  year,
  last30days = false,
  collapsible = false,
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(!collapsible);
  const [data, setData] = useState(providedData || []);
  const [loading, setLoading] = useState(!providedData);
  const [currentTime, setCurrentTime] = useState(dayjs().format('HH:mm'));
  const [average, setAverage] = useState(0);
  const [projectColors, setProjectColors] = useState(new Map());
  const [sequenceData, setSequenceData] = useState([]);
  const [localCycles, setLocalCycles] = useState([]);

  const fetchData = async () => {
    if (providedData) {
      setLoading(false);
      return;
    }

    try {
      let query = '';
      if (last30days) {
        const dowQuery = dayOfWeek !== undefined ? `&dayOfWeek=${dayOfWeek}` : '';
        query = `?last30days=true${dowQuery}`;
      } else if (dayOfWeek !== undefined && year) {
        query = `?dayOfWeek=${dayOfWeek}&year=${year}`;
      } else {
        query = `?last30days=true`;
      }
      
      const res = await fetch(`${apiUrl}/api/project_stats/task-incidence-by-time${query}`);
      const { data: fetchedData, cycles: fetchedCycles } = await res.json();
      setData(fetchedData || []);
      setLocalCycles(fetchedCycles || []);
    } catch (err) {
      console.error('Erro ao buscar dados de incidência:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (providedData || providedCycles) {
      setData(providedData || []);
      setLoading(false);
    } else {
      setLoading(true);
      fetchData();
    }
  }, [providedData, providedCycles, dayOfWeek, year, last30days]);

  useEffect(() => {
    if (!providedData && !providedCycles) {
      const interval = setInterval(fetchData, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [providedData, providedCycles, dayOfWeek, year, last30days]);

  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(dayjs().format('HH:mm'));
    }, 60 * 1000);
    return () => clearInterval(timeInterval);
  }, []);

  useEffect(() => {
    const cyclesToUse = providedCycles || localCycles;

    if (cyclesToUse && cyclesToUse.length > 0 && data.length > 0) {
      // Logic to use provided cycles from backend
      const dataMap = new Map(data.map(d => [d.time, d]));

      const chartData = cyclesToUse.map(cycle => {
        const [startH, startM] = cycle.start.split(':').map(Number);
        const [endH, endM] = cycle.end.split(':').map(Number);
        const startMin = startH * 60 + startM;
        const endMin = endH * 60 + endM;
        const duration = (endMin - startMin) + 10;

        let dominantProject = null;
        let dominantProjectId = null;
        let totalWeight = 0;
        let totalEmotionalValue = 0;

        // Calculate weighted emotional average for all slots in the cycle
        for (let i = startMin; i <= endMin; i += 10) {
          const h = Math.floor(i / 60).toString().padStart(2, '0');
          const m = (i % 60).toString().padStart(2, '0');
          const time = `${h}:${m}`;
          const dataPoint = dataMap.get(time);
          if (dataPoint) {
            if (dataPoint.dominantProject) {
              dominantProject = dataPoint.dominantProject;
              dominantProjectId = dataPoint.dominantProjectId;
            }
            if (dataPoint.emotionalAverage !== null) {
              totalWeight += dataPoint.count;
              totalEmotionalValue += dataPoint.count * dataPoint.emotionalAverage;
            }
          }
        }

        // Calculate final emotional average for the cycle
        let emotionalAverage = null;
        if (totalWeight > 0) {
          emotionalAverage = Math.round(totalEmotionalValue / totalWeight);
        }

        return {
          displayStartTime: cycle.start,
          durationMinutes: duration,
          dominantProject,
          dominantProjectId,
          emotionalAverage,
        };
      });
      setSequenceData(chartData);

    } else if (data.length > 0) {
      // Fallback to frontend detection if no cycles are provided
      const startIndex = data.findIndex((d) => d.count > 0);
      if (startIndex === -1) {
        setSequenceData([]);
        setAverage(0);
        return;
      }

      const endIndex = data.length - 1 - data.slice().reverse().findIndex((d) => d.count > 0);
      const trimmedData = data.slice(startIndex, endIndex + 1);
      
      const totalCount = trimmedData.reduce((sum, d) => sum + d.count, 0);
      const avg = totalCount / trimmedData.length;
      setAverage(avg);

      const sequences = [];
      let currentSequence = null;

      trimmedData.forEach((item, index) => {
        if (item.count >= avg) {
          if (!currentSequence) {
            currentSequence = {
              startTime: item.time,
              duration: 10,
              dominantProjectId: item.dominantProjectId,
              dominantProject: item.dominantProject,
              totalWeight: item.count,
              totalEmotionalValue: item.count * (item.emotionalAverage || 2), // Default to neutral (2) if no data
            };
          } else {
            currentSequence.duration += 10;
            currentSequence.totalWeight += item.count;
            currentSequence.totalEmotionalValue += item.count * (item.emotionalAverage || 2);
            if (item.dominantProject) {
              currentSequence.dominantProjectId = item.dominantProjectId;
              currentSequence.dominantProject = item.dominantProject;
            }
          }
        } else {
          if (currentSequence) {
            // Calculate emotional average for the sequence
            currentSequence.emotionalAverage = Math.round(currentSequence.totalEmotionalValue / currentSequence.totalWeight);
            // Remove temporary fields
            delete currentSequence.totalWeight;
            delete currentSequence.totalEmotionalValue;
            sequences.push(currentSequence);
            currentSequence = null;
          }
        }
      });

      if (currentSequence) {
        // Calculate emotional average for the last sequence
        currentSequence.emotionalAverage = Math.round(currentSequence.totalEmotionalValue / currentSequence.totalWeight);
        delete currentSequence.totalWeight;
        delete currentSequence.totalEmotionalValue;
        sequences.push(currentSequence);
      }

      const chartData = sequences.map(sequence => ({
        ...sequence,
        displayStartTime: sequence.startTime,
        durationMinutes: sequence.duration,
      }));

      setSequenceData(chartData);
    } else {
      setSequenceData([]);
    }
  }, [data, providedCycles, localCycles]);

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  const showCurrentTime = last30days || (year === dayjs().year());

  const chartContent = sequenceData.length > 0 ? (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={sequenceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <XAxis 
          dataKey="displayStartTime" 
          tickLine={false} 
          axisLine={false} 
          tick={{ fontSize: 12 }}
        />
        <YAxis 
          domain={[0, 'dataMax + 30']} 
          tick={{ fontSize: 12 }}
          label={{ value: 'Duração (min)', angle: -90, position: 'insideLeft' }}
        />
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        {showCurrentTime && <ReferenceLine x={currentTime} stroke="blue" strokeWidth={2} label={{ value: 'Agora', position: 'top' }} />}
        <Bar 
          dataKey="durationMinutes" 
          name="Duração"
          fill="#8884d8"
          shape={(props) => {
            const { x, y, width, height, index } = props;
            const item = sequenceData[index];
            if (!item) return null;
            
            const color = item.emotionalAverage ? EMOTIONAL_COLORS[item.emotionalAverage] || '#8884d8' : '#8884d8';
            return (
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={color}
                stroke={item.dominantProject ? 'rgba(0,0,0,0.1)' : 'none'}
                strokeWidth={1}
              />
            );
          }}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  ) : (
    <Typography>Ainda sem dados suficientes para calcular sequências.</Typography>
  );

  if (loading) {
    return (
      <Typography>Carregando...</Typography>
    );
  }

  const legendItems = [
    { label: 'Baixo (1)', color: EMOTIONAL_COLORS[1] },
    { label: 'Médio (2)', color: EMOTIONAL_COLORS[2] },
    { label: 'Alto (3)', color: EMOTIONAL_COLORS[3] },
  ];

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        {collapsible && (
          <IconButton onClick={toggleExpanded}>
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        )}
      </Box>
      <Collapse in={collapsible ? expanded : true}>
        {chartContent}
        {legendItems.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
            {legendItems.map(({ label, color }) => (
              <Chip
                key={label}
                label={label}
                style={{ backgroundColor: color, color: '#fff' }}
              />
            ))}
          </Box>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Mostrando sequências de trabalho consecutivas (acima da média)
        </Typography>
      </Collapse>
    </>
  );
}
