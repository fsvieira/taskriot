import dotenv from 'dotenv';
dotenv.config();

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

// Função auxiliar para calcular rankings de projetos usando o novo algoritmo
function calculateProjectRanks(projects, now) {
  if (!projects || projects.length === 0) return projects;

  // 1. Calcular a média global de conclusão (MPs)
  const totalPercent = projects.reduce((sum, p) => sum + (p.tasks?.percent_closed || 0), 0);
  const MPs = totalPercent / projects.length;
  console.log('[RANK] MPs (global mean completion):', MPs.toFixed(2));

  // 2. Obter last_end_session para cada projeto
  const projectsWithSessions = projects.map(p => {
    const lastSessionEnd = p.last_end_session ? dayjs(p.last_end_session).utc() : null;
    return {
      ...p,
      _lastSessionEnd: lastSessionEnd
    };
  });

  // 3. Calcular velocidade (V_p) e potencial para cada projeto
  projectsWithSessions.forEach(p => {
    const ES = p.emotional_score || 2; // Emotional Score (1-3 scale, default 2)
    const CP = p.tasks?.percent_closed || 0; // Completion Percentage
    
    // Velocidade: V_p = (ES * 0.7) + (MPs - CP) * 0.3
    // Normalizar ES para 0-100 scale para consistência
    const ESNormalized = (ES / 3) * 100; // Convert 1-3 to 0-100
    const stabilityForce = MPs - CP; // Positive if below average (needs attention)
    
    p.velocity = (ESNormalized * 0.7) + (stabilityForce * 0.3);
    
    // Calcular tempo desde última sessão (em horas)
    let hoursSinceLastSession = 0;
    if (p._lastSessionEnd && p._lastSessionEnd.isValid()) {
      hoursSinceLastSession = now.diff(p._lastSessionEnd, 'hour', true);
    } else {
      // Se nunca teve sessão, usar tempo desde criação (limitado a 24h)
      hoursSinceLastSession = Math.min(now.diff(dayjs(p.created_at).utc(), 'hour', true), 24);
    }
    
    // Potencial: Potential_p = (NOW() - last_end_session) * V_p
    p.potential = hoursSinceLastSession * p.velocity;
    
    // Guardar valores para debug
    p._mp = MPs;
    p._cp = CP;
    p._es = ESNormalized;
    p._stabilityForce = stabilityForce;
    p._hoursSinceLastSession = hoursSinceLastSession;
    
    console.log(`[RANK] Project "${p.name}": ES=${ES.toFixed(2)} (norm=${ESNormalized.toFixed(1)}), CP=${CP}%, stabilityForce=${stabilityForce.toFixed(1)}, velocity=${p.velocity.toFixed(2)}, hoursSinceLastSession=${hoursSinceLastSession.toFixed(1)}, potential=${p.potential.toFixed(2)}`);
  });

  // 4. Ordenar por potencial (maior no topo)
  projectsWithSessions.sort((a, b) => b.potential - a.potential);

  // 5. Atribuir rank baseado na posição
  projectsWithSessions.forEach((p, idx) => {
    p.rank = idx + 1;
    console.log(`[RANK] Final rank for "${p.name}": #${p.rank} (potential: ${p.potential?.toFixed(2) || 'N/A'})`);
  });

  return projectsWithSessions;
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

    // 4.5. Última sessão terminada por projeto (para cálculo de potencial)
    const lastSessionRows = await db('project_sessions')
      .select('project_id')
      .whereIn('project_id', mergedQueue)
      .whereNotNull('end_counter')
      .groupBy('project_id')
      .select(db.raw('MAX(end_counter) as last_end_session'));
    const lastSessionMap = {};
    for (const row of lastSessionRows) {
      lastSessionMap[row.project_id] = row.last_end_session;
    }

    // 4.6. Última tarefa concluída por projeto
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
          last_end_session: lastSessionMap[id] || null,
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

    // Ordenar projetos pelo rank (baseado em potencial)
    const nowJs = dayjs().utc();
    const rankedProjects = calculateProjectRanks(orderedProjects, nowJs);
    
    // Log what we're sending
    console.log('[RANK] Sending response with projects:');
    rankedProjects.forEach(p => {
      console.log(`  - ${p.name}: potential=${p.potential?.toFixed(2)}, velocity=${p.velocity?.toFixed(2)}, rank=${p.rank}`);
    });

    res.json({
      id: queueId,
      name: queueName,
      project_ids: mergedQueue,
      projects: rankedProjects
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

    // 3.5. Última sessão terminada por projeto (para cálculo de potencial)
    const lastSessionRowsReorder = await db('project_sessions')
      .select('project_id')
      .whereIn('project_id', mergedQueue)
      .whereNotNull('end_counter')
      .groupBy('project_id')
      .select(db.raw('MAX(end_counter) as last_end_session'));
    const lastSessionMapReorder = {};
    for (const row of lastSessionRowsReorder) {
      lastSessionMapReorder[row.project_id] = row.last_end_session;
    }

    // 3.6. Última tarefa concluída por projeto
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
          last_end_session: lastSessionMapReorder[id] || null,
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


    // Calcular rankings usando o novo algoritmo e ordenar
    const nowJs = dayjs().utc();
    const rankedProjects = calculateProjectRanks(orderedProjects, nowJs);
    const reorderedIds = rankedProjects.map(p => p.id);
    
    // Log what we're sending
    console.log('[RANK] Reorder response with projects:');
    rankedProjects.forEach(p => {
      console.log(`  - ${p.name}: potential=${p.potential?.toFixed(2)}, velocity=${p.velocity?.toFixed(2)}, rank=${p.rank}`);
    });

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
      projects: rankedProjects
    });

  } catch (err) {
    console.error("Erro ao reordenar queue:", err);
    res.status(500).json({ error: "errors.internal.reorderQueue" });
  }
};