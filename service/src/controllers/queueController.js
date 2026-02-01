import dotenv from 'dotenv';
dotenv.config();

const RANK_AVG_WEIGHT = parseFloat(process.env.RANK_AVG_WEIGHT) || 0.5;
const EMOTIONAL_WEIGHT = parseFloat(process.env.EMOTIONAL_WEIGHT) || 0.5;
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
dayjs.extend(utc);

/**
 * GET /api/queues
 */
export const listQueues = async (req, res) => {
  const db = req.db;
  const queuesRaw = await db("queues").select("*");

  // Converter project_ids de string JSON para array
  const queues = queuesRaw.map(queue => ({
    ...queue,
    project_ids: queue.project_ids ? JSON.parse(queue.project_ids) : [],
  }));

  res.json(queues);
};


/**
 * POST /api/queues
 */
export const createQueue = async (req, res) => {
  const db = req.db;
  const { name, project_ids } = req.body;

  if (!name) {
    return res.status(400).json({ error: "errors.queues.nameRequired" });
  }

  try {
    const [id] = await db("queues").insert({
      name,
      project_ids: JSON.stringify(project_ids || []),
      created_at: dayjs().toISOString(),
      updated_at: dayjs().toISOString(),
    });

    res.status(201).json({ id });
  } catch (err) {
    console.error("Erro ao criar queue:", err);
    res.status(500).json({ error: "errors.internal.createQueue" });
  }
};

/**
 * PUT /api/queues/:id
 */
export const updateQueue = async (req, res) => {
  const db = req.db;
  const { id } = req.params;
  const { name, project_ids } = req.body;

  try {
    await db("queues")
      .where({ id })
      .update({
        ...(name && { name }),
        ...(project_ids && { project_ids: JSON.stringify(project_ids) }),
        updated_at: dayjs().toISOString(),
      });

    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao atualizar queue:", err);
    res.status(500).json({ error: "errors.internal.updateQueue" });
  }
};

/**
 * DELETE /api/queues/:id
 */
export const deleteQueue = async (req, res) => {
  const db = req.db;
  const { id } = req.params;

  try {
    await db("queues").where({ id }).del();
    res.json({ success: true });
  } catch (err) {
    console.error("Erro ao apagar queue:", err);
    res.status(500).json({ error: "errors.internal.deleteQueue" });
  }
};

// Função auxiliar para obter estatísticas de tarefas por projeto
async function getProjectTaskStats(db, projectIds, dateStart = null, dateEnd = null) {
  const params = {
    dateStart: dateStart || '1970-01-01T00:00:00.000Z',
    dateEnd: dateEnd || dayjs().toISOString(),
    ...projectIds.reduce((acc, id, idx) => ({ ...acc, [`id${idx}`]: id }), {})
  };
  const inPlaceholders = projectIds.map((_, idx) => `:id${idx}`).join(',');

  const rawQuery = `
    SELECT
      project_id,
      SUM(CASE WHEN state = 'open' THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN state = 'closed' AND closed_at >= :dateStart AND closed_at <= :dateEnd THEN 1 ELSE 0 END) AS closed
    FROM tasks
    WHERE project_id IN (${inPlaceholders})
    AND (is_recurring IS NULL OR is_recurring = false)
    GROUP BY project_id
  `;

  const result = await db.raw(rawQuery, params);
  const rows = Array.isArray(result) ? result : result[0];

  const stats = {};
  for (const row of rows) {
    const open = Number(row.open);
    const closed = Number(row.closed);
    const total = open + closed;
    const percent = total > 0 ? Math.round((closed / total) * 100) : 0;
    stats[row.project_id] = { open, closed, percent };
  }

  return stats;
}

// Função auxiliar para obter estatísticas de tarefas por períodos
async function getProjectTaskStatsByPeriod(db, projectIds) {
  const now = dayjs().utc();

  const today = now.startOf('day').toISOString();
  const week = now.startOf('week').toISOString();
  const month = now.startOf('month').toISOString();

  const [todayStats, weekStats, monthStats] = await Promise.all([
    getProjectTaskStats(db, projectIds, today, now.toISOString()),
    getProjectTaskStats(db, projectIds, week, now.toISOString()),
    getProjectTaskStats(db, projectIds, month, now.toISOString()),
  ]);

  return { todayStats, weekStats, monthStats };
}

// Função auxiliar para calcular rankings de projetos
function calculateProjectRanks(projects) {
  // Função para calcular ranks para um dado critério
  const calcRanks = (projects, getValue, rankKey, direction = 'asc') => {
    const sorted = projects
      .slice()
      .sort((a, b) => {
        const valA = getValue(a);
        const valB = getValue(b);
        if (valA !== valB) {
          if (direction === 'desc') {
            return valB - valA; // higher first
          } else {
            return valA - valB; // lower first
          }
        }
        // Tie-breaker: older last_completed first
        return new Date(a.last_completed) - new Date(b.last_completed);
      });
    sorted.forEach((p, idx) => { p[rankKey] = idx + 1; });
  };

  // Critérios de ranking
  const rankingCriteria = [
    {
      key: 'perc_global',
      getValue: p => p.tasks.percent_closed ?? 0,
    },
    {
      key: 'perc_today',
      getValue: p => p.tasks.by_period.today.percent_closed ?? 0,
    },
    {
      key: 'perc_week',
      getValue: p => p.tasks.by_period.week.percent_closed ?? 0,
    },
    {
      key: 'perc_month',
      getValue: p => p.tasks.by_period.month.percent_closed ?? 0,
    },
    {
      key: 'time_today',
      getValue: p => Math.floor((p.timeToday ?? 0) / 1),
    },
    {
      key: 'time_week',
      getValue: p => Math.floor((p.timeThisWeek ?? 0) / 2),
    },
    {
      key: 'time_month',
      getValue: p => Math.floor((p.timeThisMonth ?? 0) / 4),
    },
    {
      key: 'time_total',
      getValue: p => Math.floor((p.timeTotal ?? 0) / 8),
    },
    {
      key: 'emotional_score',
      getValue: p => p.emotional_score ?? 0,
      direction: 'desc'
    },
  ];

  // Calcular ranks para cada critério
  rankingCriteria.forEach(({ key, getValue, direction = 'asc' }) => {
    calcRanks(projects, getValue, `${key}_rank`, direction);
  });

  // Calcular média dos ranks sem ES
  projects.forEach(p => {
    const rankKeys = [
      'perc_global_rank',
      'perc_today_rank',
      'perc_week_rank',
      'perc_month_rank',
      'time_today_rank',
      'time_week_rank',
      'time_month_rank',
      'time_total_rank',
    ];
    p.rank_avg = rankKeys.reduce((sum, k) => sum + (p[k] ?? 0), 0) / rankKeys.length;
    // Calcular rank final com peso para ES
    p.final_rank = p.rank_avg * RANK_AVG_WEIGHT + p.emotional_score_rank * EMOTIONAL_WEIGHT;
  });

  return projects;
}

export const getQueueProjects = async (req, res) => {
  const db = req.db;
  const queueName = req.params.name || 'default';

  try {
    // 1. Obter fila e projetos ativos
    const queueRow = await db("queues").where({ name: queueName }).first();
    let queueIds = queueRow?.project_ids ? JSON.parse(queueRow.project_ids) : [];
    const activeProjects = await db("projects").where({ state: "active" });
    const activeIdsSet = new Set(activeProjects.map(p => p.id));
    const filteredQueue = queueIds.filter(id => activeIdsSet.has(id));
    const missingProjects = activeProjects.filter(p => !filteredQueue.includes(p.id));
    const mergedQueue = [...filteredQueue, ...missingProjects.map(p => p.id)];

    // 2. Atualizar ordem se necessário
    let queueId = queueRow?.id;
    const hasChanged = JSON.stringify(queueIds) !== JSON.stringify(mergedQueue);
    if (queueRow && hasChanged) {
      await db("queues").where({ id: queueRow.id }).update({
        project_ids: JSON.stringify(mergedQueue),
        updated_at: dayjs().toISOString(),
      });
    } else if (!queueRow) {
      const [newId] = await db("queues").insert({
        name: queueName,
        project_ids: JSON.stringify(mergedQueue),
        created_at: dayjs().toISOString(),
        updated_at: dayjs().toISOString(),
      });
      queueId = newId;
    }

    // 3. Estatísticas de sessões (mantém)
    const today = dayjs().utc().startOf('day').toISOString();
    const monday = dayjs().utc().startOf('week').toISOString();
    const startOfMonth = dayjs().utc().startOf('month').toISOString();
    const now = dayjs().utc().toISOString();

    const statsRows = await db('project_sessions')
      .select('project_id')
      .whereIn('project_id', mergedQueue)
      .whereNotNull('end_counter')
      .groupBy('project_id')
      .select(
        db.raw(`
          SUM(CASE WHEN start_counter >= ? AND start_counter < ? THEN (julianday(end_counter) - julianday(start_counter)) * 24.0 ELSE 0 END) AS timeToday,
          SUM(CASE WHEN start_counter >= ? AND start_counter < ? THEN (julianday(end_counter) - julianday(start_counter)) * 24.0 ELSE 0 END) AS timeThisWeek,
          SUM(CASE WHEN start_counter >= ? AND start_counter < ? THEN (julianday(end_counter) - julianday(start_counter)) * 24.0 ELSE 0 END) AS timeThisMonth,
          SUM((julianday(end_counter) - julianday(start_counter)) * 24.0) AS timeTotal
        `, [today, now, monday, now, startOfMonth, now])
      );
    const statsByProject = {};
    for (const row of statsRows) {
      statsByProject[row.project_id] = {
        timeToday: Number(row.timeToday) || 0,
        timeThisWeek: Number(row.timeThisWeek) || 0,
        timeThisMonth: Number(row.timeThisMonth) || 0,
        timeTotal: Number(row.timeTotal) || 0,
      };
    }

    // 4. Estatísticas de tarefas
    const taskStats = await getProjectTaskStats(db, mergedQueue);

    // Stats por período
    const { todayStats, weekStats, monthStats } = await getProjectTaskStatsByPeriod(db, mergedQueue);

    // 4.5. Última tarefa concluída por projeto
    const lastCompletedRows = await db('tasks')
      .select('project_id')
      .whereIn('project_id', mergedQueue)
      .where('state', 'closed')
      .groupBy('project_id')
      .select(db.raw('MAX(closed_at) as last_completed'));
    const lastCompletedMap = {};
    for (const row of lastCompletedRows) {
      lastCompletedMap[row.project_id] = row.last_completed;
    }

    // 5. Emotional data
    const emotionalData = {};
    for (const projectId of mergedQueue) {
      try {
        const indicators = await db('project_emotional_indicators as pei')
          .select('pei.indicator', 'pei.value')
          .join(
            db('project_emotional_indicators as sub')
              .select('indicator')
              .max('id as max_id')
              .where('sub.project_id', projectId)
              .groupBy('indicator')
              .as('sub'),
            'pei.id',
            'sub.max_id'
          );

        const latestIndicators = {};
        indicators.forEach(ind => {
          latestIndicators[ind.indicator] = ind.value;
        });

        const A = latestIndicators[1] ?? 2; // calmer
        const B = latestIndicators[2] ?? 2; // progressed
        const C = latestIndicators[3] ?? 2; // motivate
        const ES = A * 0.5 + C * 0.35 + B * 0.15;
        const average = (A + B + C) / 3;
        emotionalData[projectId] = {
          emotional_average: Math.round(average),
          emotional_score: ES
        };
      } catch (err) {
        const defaultES = 2 * 0.5 + 2 * 0.35 + 1 * 0.15;
        emotionalData[projectId] = {
          emotional_average: 2,
          emotional_score: defaultES
        };
      }
    }

    // 6. Montar resposta
    const projectMap = new Map(activeProjects.map(p => [p.id, p]));
    const orderedProjects = mergedQueue
      .map(id => {
        const p = projectMap.get(id);
        if (!p) return null;

        return {
          ...p,
          ...statsByProject[id],
          emotional_average: emotionalData[id].emotional_average,
          emotional_score: emotionalData[id].emotional_score,
          last_completed: lastCompletedMap[id] || p.created_at,
          tasks: {
            total_open: taskStats[id]?.open || 0,
            total_closed: taskStats[id]?.closed || 0,
            percent_closed: taskStats[id]?.percent || 0,
            by_period: {
              today: {
                open: todayStats[id]?.open || 0,
                closed: todayStats[id]?.closed || 0,
                percent_closed: todayStats[id]?.percent || 0,
              },
              week: {
                open: weekStats[id]?.open || 0,
                closed: weekStats[id]?.closed || 0,
                percent_closed: weekStats[id]?.percent || 0,
              },
              month: {
                open: monthStats[id]?.open || 0,
                closed: monthStats[id]?.closed || 0,
                percent_closed: monthStats[id]?.percent || 0,
              }
            }
          }
        };
      })
      .filter(Boolean);

    // Ordenar projetos pelo final_rank para exibir sempre ordenados
    calculateProjectRanks(orderedProjects);
    // Pre-sort by last_completed for stability
    orderedProjects.sort((a, b) => new Date(a.last_completed) - new Date(b.last_completed));
    // Then sort by final_rank (stable due to pre-sort)
    orderedProjects.sort((a, b) => a.final_rank - b.final_rank);

    res.json({
      id: queueId,
      name: queueName,
      project_ids: mergedQueue,
      projects: orderedProjects,
      ranking_weights: { rank_avg: RANK_AVG_WEIGHT, emotional: EMOTIONAL_WEIGHT }
    });

  } catch (err) {
    console.error("Erro ao obter queue projects:", err);
    res.status(500).json({ error: "errors.internal.getQueueProjects" });
  }
};

export const reorderQueue = async (req, res) => {
  const db = req.db;
  const queueName = req.params.name || 'default';

  try {
    // 1. Obter fila e projetos ativos
    const queueRow = await db("queues").where({ name: queueName }).first();
    let queueIds = queueRow?.project_ids ? JSON.parse(queueRow.project_ids) : [];
    const activeProjects = await db("projects").where({ state: "active" });
    const activeIdsSet = new Set(activeProjects.map(p => p.id));
    const filteredQueue = queueIds.filter(id => activeIdsSet.has(id));
    const missingProjects = activeProjects.filter(p => !filteredQueue.includes(p.id));
    const mergedQueue = [...filteredQueue, ...missingProjects.map(p => p.id)];

    // 2. Estatísticas de sessões (mantém)
    const today = dayjs().utc().startOf('day').toISOString();
    const monday = dayjs().utc().startOf('week').toISOString();
    const startOfMonth = dayjs().utc().startOf('month').toISOString();
    const now = dayjs().utc().toISOString();

    const statsRows = await db('project_sessions')
      .select('project_id')
      .whereIn('project_id', mergedQueue)
      .whereNotNull('end_counter')
      .groupBy('project_id')
      .select(
        db.raw(`
          SUM(CASE WHEN start_counter >= ? AND start_counter < ? THEN (julianday(end_counter) - julianday(start_counter)) * 24.0 ELSE 0 END) AS timeToday,
          SUM(CASE WHEN start_counter >= ? AND start_counter < ? THEN (julianday(end_counter) - julianday(start_counter)) * 24.0 ELSE 0 END) AS timeThisWeek,
          SUM(CASE WHEN start_counter >= ? AND start_counter < ? THEN (julianday(end_counter) - julianday(start_counter)) * 24.0 ELSE 0 END) AS timeThisMonth,
          SUM((julianday(end_counter) - julianday(start_counter)) * 24.0) AS timeTotal
        `, [today, now, monday, now, startOfMonth, now])
      );
    const statsByProject = {};
    for (const row of statsRows) {
      statsByProject[row.project_id] = {
        timeToday: Number(row.timeToday) || 0,
        timeThisWeek: Number(row.timeThisWeek) || 0,
        timeThisMonth: Number(row.timeThisMonth) || 0,
        timeTotal: Number(row.timeTotal) || 0,
      };
    }

    // 3. Estatísticas de tarefas
    const taskStats = await getProjectTaskStats(db, mergedQueue);

    // Stats por período
    const { todayStats, weekStats, monthStats } = await getProjectTaskStatsByPeriod(db, mergedQueue);

    // 3.5. Última tarefa concluída por projeto
    const lastCompletedRowsReorder = await db('tasks')
      .select('project_id')
      .whereIn('project_id', mergedQueue)
      .where('state', 'closed')
      .groupBy('project_id')
      .select(db.raw('MAX(closed_at) as last_completed'));
    const lastCompletedMapReorder = {};
    for (const row of lastCompletedRowsReorder) {
      lastCompletedMapReorder[row.project_id] = row.last_completed;
    }

    // 4. Emotional data
    const emotionalData = {};
    for (const projectId of mergedQueue) {
      try {
        const indicators = await db('project_emotional_indicators as pei')
          .select('pei.indicator', 'pei.value')
          .join(
            db('project_emotional_indicators as sub')
              .select('indicator')
              .max('id as max_id')
              .where('sub.project_id', projectId)
              .groupBy('indicator')
              .as('sub'),
            'pei.id',
            'sub.max_id'
          );

        const latestIndicators = {};
        indicators.forEach(ind => {
          latestIndicators[ind.indicator] = ind.value;
        });

        const A = latestIndicators[1] ?? 2; // calmer
        const B = latestIndicators[2] ?? 2; // progressed
        const C = latestIndicators[3] ?? 2; // motivate
        const ES = A * 0.5 + C * 0.35 + B * 0.15;
        const average = (A + B + C) / 3;
        emotionalData[projectId] = {
          emotional_average: Math.round(average),
          emotional_score: ES
        };
      } catch (err) {
        const defaultES = 2 * 0.5 + 2 * 0.35 + 2 * 0.15;
        emotionalData[projectId] = {
          emotional_average: 2,
          emotional_score: defaultES
        };
      }
    }

    // 5. Montar resposta
    const projectMap = new Map(activeProjects.map(p => [p.id, p]));
    const orderedProjects = mergedQueue
      .map(id => {
        const p = projectMap.get(id);
        if (!p) return null;

        return {
          ...p,
          ...statsByProject[id],
          emotional_average: emotionalData[id].emotional_average,
          emotional_score: emotionalData[id].emotional_score,
          last_completed: lastCompletedMapReorder[id] || p.created_at,
          tasks: {
            total_open: taskStats[id]?.open || 0,
            total_closed: taskStats[id]?.closed || 0,
            percent_closed: taskStats[id]?.percent || 0,
            by_period: {
              today: {
                open: todayStats[id]?.open || 0,
                closed: todayStats[id]?.closed || 0,
                percent_closed: todayStats[id]?.percent || 0,
              },
              week: {
                open: weekStats[id]?.open || 0,
                closed: weekStats[id]?.closed || 0,
                percent_closed: weekStats[id]?.percent || 0,
              },
              month: {
                open: monthStats[id]?.open || 0,
                closed: monthStats[id]?.closed || 0,
                percent_closed: monthStats[id]?.percent || 0,
              }
            }
          }
        };
      })
      .filter(Boolean);


    // Calcular rankings usando função auxiliar e ordenar
    calculateProjectRanks(orderedProjects);
    // Pre-sort by last_completed for stability
    orderedProjects.sort((a, b) => new Date(a.last_completed) - new Date(b.last_completed));
    // Then sort by final_rank (stable due to pre-sort)
    orderedProjects.sort((a, b) => a.final_rank - b.final_rank);
    const reorderedIds = orderedProjects.map(p => p.id);

    // 5. Atualizar ordem na BD
    if (queueRow) {
      await db("queues").where({ id: queueRow.id }).update({
        project_ids: JSON.stringify(reorderedIds),
        updated_at: dayjs().toISOString(),
      });
    }

    res.json({
      id: queueRow?.id,
      name: queueName,
      project_ids: reorderedIds,
      projects: orderedProjects,
      ranking_weights: { rank_avg: RANK_AVG_WEIGHT, emotional: EMOTIONAL_WEIGHT }
    });

  } catch (err) {
    console.error("Erro ao reordenar queue:", err);
    res.status(500).json({ error: "errors.internal.reorderQueue" });
  }
};