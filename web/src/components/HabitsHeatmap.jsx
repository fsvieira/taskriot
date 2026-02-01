import React from 'react';


const getColor = (percentage) => {
  if (percentage === null || percentage === undefined || isNaN(percentage) || percentage === 0) {
    return 'rgb(245, 245, 245)'; // Cinza muito claro para dados ausentes ou zero
  }

  let hue;
  if (percentage <= 1) {
    // Interpola de vermelho (0) para verde (120)
    hue = percentage * 120;
  } else {
    // Interpola de verde (120) para roxo (280)
    const purpleHue = 280;
    const greenHue = 120;
    // Escala a percentagem para o intervalo 0-1 para a interpolação
    const scaledPercentage = Math.min((percentage - 1), 1); // Limita em 200%
    hue = greenHue + (purpleHue - greenHue) * scaledPercentage;
  }

  const saturation = 70; // Reduzido de 100 para 70 para menos saturação
  const lightness = 60; // Aumentado de 50 para 60 para mais clareza

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

const periodLabels = {
  day: Array.from({ length: 24 }, (_, i) => `${i}h`),
  week: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
  month: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'],
  year: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
};

export default function HabitsHeatmap({ habits, period = 'week' }) {
  let labels = periodLabels[period];

  if (period === 'day') {
    const totalColumns = 24;
    if (totalColumns > 10) {
      // Se mais que 10 colunas, mostrar apenas horas que têm pelo menos um valor > 0
      const activeHours = new Set();
      habits && habits.forEach(habit => {
        if (habit.values) {
          habit.values.forEach((value, hour) => {
            if (value > 0) {
              activeHours.add(hour);
            }
          });
        }
      });
      labels = Array.from(activeHours).sort((a, b) => a - b).map(hour => `${hour}h`);
    } else {
      // Se <= 10 colunas, mostrar todas as horas
      labels = periodLabels.day;
    }
  } else if (period === 'week') {
    const totalColumns = 7;
    if (totalColumns > 10) {
      // Se mais que 10 colunas, mostrar apenas dias que têm pelo menos um valor > 0
      const activeDays = new Set();
      habits && habits.forEach(habit => {
        if (habit.values) {
          habit.values.forEach((value, day) => {
            if (value > 0) {
              activeDays.add(day);
            }
          });
        }
      });
      // Map day numbers to labels (0=Dom, 1=Seg, 2=Ter, etc.)
      const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      labels = Array.from(activeDays).sort((a, b) => a - b).map(day => dayNames[day]);
    } else {
      // Se <= 10 colunas, mostrar todos os dias
      labels = periodLabels.week;
    }
  } else if (period === 'month') {
    const totalColumns = 5; // Max 5 weeks in a month
    if (totalColumns > 10) {
      // Se mais que 10 colunas, mostrar apenas semanas que têm pelo menos um valor > 0
      const activeWeeks = new Set();
      habits && habits.forEach(habit => {
        if (habit.values) {
          habit.values.forEach((value, week) => {
            if (value > 0) {
              activeWeeks.add(week);
            }
          });
        }
      });
      labels = Array.from(activeWeeks).sort((a, b) => a - b).map(week => `Sem ${week + 1}`);
    } else {
      // Se <= 10 colunas, mostrar todas as semanas
      labels = periodLabels.month;
    }
  } else if (period === 'year') {
    const totalColumns = 12; // 12 months in a year
    if (totalColumns > 10) {
      // Se mais que 10 colunas, mostrar apenas meses que têm pelo menos um valor > 0
      const activeMonths = new Set();
      habits && habits.forEach(habit => {
        if (habit.values) {
          habit.values.forEach((value, month) => {
            if (value > 0) {
              activeMonths.add(month);
            }
          });
        }
      });
      labels = Array.from(activeMonths).sort((a, b) => a - b).map(month => periodLabels.year[month]);
    } else {
      // Se <= 10 colunas, mostrar todos os meses
      labels = periodLabels.year;
    }
  } else {
    // Para outros períodos, uma coluna "Total"
    labels = ['Total'];
  }


  return (
    <table style={{ borderCollapse: 'separate', borderSpacing: '4px', width: '100%' }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left', padding: '8px' }}>Hábito</th>
          {labels.map(label => (
            <th key={label} style={{ textAlign: 'center', padding: '8px', fontWeight: 500 }}>{label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {habits && habits.map(habit => (
          <tr key={habit.name}>
            <td style={{
              padding: '8px',
              fontWeight: 500,
              maxWidth: '200px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              title: habit.name // Mostra o nome completo no hover
            }}>
              {habit.name}
            </td>
            {(period === 'day' || period === 'week' || period === 'month' || period === 'year') ? (
              labels.map((label, idx) => {
                let valueIndex;
                if (period === 'day') {
                  if (label.includes('h')) {
                    valueIndex = parseInt(label); // hour number from filtered labels like "8h"
                  } else {
                    valueIndex = parseInt(label); // fallback for full labels
                  }
                } else if (period === 'week') {
                  // For week, map day name back to index
                  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                  valueIndex = dayNames.indexOf(label);
                } else if (period === 'month') {
                  if (label.includes('Sem')) {
                    valueIndex = parseInt(label.split(' ')[1]) - 1; // "Sem 1" -> 0
                  } else {
                    // For full labels like "Semana 1", extract the number
                    const match = label.match(/(\d+)/);
                    valueIndex = match ? parseInt(match[1]) - 1 : 0;
                  }
                } else if (period === 'year') {
                  // For year, map month name back to index
                  valueIndex = periodLabels.year.indexOf(label);
                }
                const p = habit.values ? habit.values[valueIndex] || 0 : 0;
                return (
                  <td
                    key={idx}
                    style={{
                      padding: '6px',
                      textAlign: 'center',
                      background: getColor(p),
                      color: p > 1.5 ? '#fff' : '#333',
                      borderRadius: 6,
                      fontWeight: 500,
                      fontSize: '0.85em',
                      minWidth: '40px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                      border: '1px solid rgba(255,255,255,0.2)',
                    }}
                    title={`${(p * 100).toFixed(0)}%`}
                  >
                    {p > 0 ? `${(p * 100).toFixed(0)}%` : ''}
                  </td>
                );
              })
            ) : (
              <td
                style={{
                  padding: '6px',
                  textAlign: 'center',
                  background: getColor(habit.percentage),
                  color: habit.percentage > 1.5 ? '#fff' : '#333',
                  borderRadius: 6,
                  fontWeight: 500,
                  fontSize: '0.85em',
                  minWidth: '60px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
                title={`${(habit.percentage * 100).toFixed(0)}%`}
              >
                {`${(habit.percentage * 100).toFixed(0)}%`}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}