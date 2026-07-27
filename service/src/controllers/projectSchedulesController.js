export const getProjectSchedules = async (req, res) => {
  try {
    const schedules = await req.db('project_schedules')
      .select('id', 'project_id', 'month_index', 'week')
      .orderBy(['project_id', 'month_index', 'week']);

    res.json(schedules);
  } catch (err) {
    console.error('Erro ao buscar project schedules:', err);
    res.status(500).json({ error: 'errors.internal.generic' });
  }
};

export const saveProjectSchedules = async (req, res) => {
  try {
    const { schedules } = req.body; // Array of { project_id, month_index, week }

    if (!Array.isArray(schedules)) {
      return res.status(400).json({ error: 'schedules must be an array' });
    }

    // Validate each entry
    for (const s of schedules) {
      if (!s.project_id || s.month_index === undefined || s.week === undefined) {
        return res.status(400).json({ error: 'Each schedule must have project_id, month_index, and week' });
      }
      if (s.month_index < 0 || s.month_index > 11) {
        return res.status(400).json({ error: 'month_index must be between 0 and 11' });
      }
      if (s.week < 1 || s.week > 4) {
        return res.status(400).json({ error: 'week must be between 1 and 4' });
      }
    }

    const now = new Date().toISOString();

    // Delete all existing project schedules and re-insert
    await req.db('project_schedules').del();

    if (schedules.length > 0) {
      const rows = schedules.map(s => ({
        project_id: s.project_id,
        month_index: s.month_index,
        week: s.week,
        created_at: now,
        updated_at: now,
      }));

      await req.db('project_schedules').insert(rows);
    }

    res.json({ success: true, count: schedules.length });
  } catch (err) {
    console.error('Erro ao salvar project schedules:', err);
    res.status(500).json({ error: 'errors.internal.generic' });
  }
};