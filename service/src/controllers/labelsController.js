import dayjs from 'dayjs';

// === CRUD Labels ===

export const getLabels = async (req, res) => {
  try {
    const labels = await req.db('labels').orderBy('id', 'asc');
    res.json(labels);
  } catch (err) {
    console.error('Erro ao buscar labels:', err);
    res.status(500).json({ error: 'errors.internal.generic' });
  }
};

export const createLabel = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'errors.labels.nameRequired' });
    }

    const now = dayjs().toISOString();
    const [id] = await req.db('labels').insert({
      name: name.trim(),
      created_at: now,
      updated_at: now
    });

    const label = await req.db('labels').where({ id }).first();
    res.status(201).json(label);
  } catch (err) {
    console.error('Erro ao criar label:', err);
    res.status(500).json({ error: 'errors.internal.generic' });
  }
};

export const updateLabel = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const existing = await req.db('labels').where({ id }).first();
    if (!existing) {
      return res.status(404).json({ error: 'errors.labels.notFound' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'errors.labels.nameRequired' });
    }

    const now = dayjs().toISOString();
    await req.db('labels').where({ id }).update({
      name: name.trim(),
      updated_at: now
    });

    const label = await req.db('labels').where({ id }).first();
    res.json(label);
  } catch (err) {
    console.error('Erro ao atualizar label:', err);
    res.status(500).json({ error: 'errors.internal.generic' });
  }
};

export const deleteLabel = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await req.db('labels').where({ id }).first();
    if (!existing) {
      return res.status(404).json({ error: 'errors.labels.notFound' });
    }

    await req.db('labels').where({ id }).del();
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao apagar label:', err);
    res.status(500).json({ error: 'errors.internal.generic' });
  }
};

// === Label Schedules ===

export const getLabelSchedules = async (req, res) => {
  try {
    const { labelId } = req.params;

    const schedules = await req.db('label_schedules')
      .where({ label_id: labelId })
      .orderBy('day_of_week', 'asc')
      .orderBy('start_time', 'asc');

    res.json(schedules);
  } catch (err) {
    console.error('Erro ao buscar horários da label:', err);
    res.status(500).json({ error: 'errors.internal.generic' });
  }
};

export const createLabelSchedule = async (req, res) => {
  try {
    const { labelId } = req.params;
    const { day_of_week, start_time, end_time } = req.body;

    // Validate label exists
    const label = await req.db('labels').where({ id: labelId }).first();
    if (!label) {
      return res.status(404).json({ error: 'errors.labels.notFound' });
    }

    if (day_of_week === undefined || day_of_week < 0 || day_of_week > 6) {
      return res.status(400).json({ error: 'errors.labels.invalidDayOfWeek' });
    }

    if (!start_time || !end_time) {
      return res.status(400).json({ error: 'errors.labels.timeRequired' });
    }

    if (start_time >= end_time) {
      return res.status(400).json({ error: 'errors.labels.invalidTimeRange' });
    }

    const now = dayjs().toISOString();
    const [id] = await req.db('label_schedules').insert({
      label_id: labelId,
      day_of_week,
      start_time,
      end_time,
      created_at: now,
      updated_at: now
    });

    const schedule = await req.db('label_schedules').where({ id }).first();
    res.status(201).json(schedule);
  } catch (err) {
    console.error('Erro ao criar horário de label:', err);
    res.status(500).json({ error: 'errors.internal.generic' });
  }
};

export const deleteLabelSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;

    const existing = await req.db('label_schedules').where({ id: scheduleId }).first();
    if (!existing) {
      return res.status(404).json({ error: 'errors.labels.scheduleNotFound' });
    }

    await req.db('label_schedules').where({ id: scheduleId }).del();
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao apagar horário de label:', err);
    res.status(500).json({ error: 'errors.internal.generic' });
  }
};

// === Task Labels (many-to-many) ===

export const getTaskLabels = async (req, res) => {
  try {
    const { taskId } = req.params;

    const labels = await req.db('task_labels')
      .join('labels', 'task_labels.label_id', 'labels.id')
      .where('task_labels.task_id', taskId)
      .select('labels.id', 'labels.name', 'labels.created_at', 'labels.updated_at')
      .orderBy('labels.id', 'asc');

    res.json(labels);
  } catch (err) {
    console.error('Erro ao buscar labels da tarefa:', err);
    res.status(500).json({ error: 'errors.internal.generic' });
  }
};

export const setTaskLabels = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { label_ids } = req.body;

    if (!Array.isArray(label_ids)) {
      return res.status(400).json({ error: 'errors.labels.labelIdsRequired' });
    }

    // Verify task exists
    const task = await req.db('tasks').where({ id: taskId }).first();
    if (!task) {
      return res.status(404).json({ error: 'errors.tasks.taskNotFound' });
    }

    // Replace all labels for this task
    await req.db.transaction(async (trx) => {
      // Remove existing associations
      await trx('task_labels').where({ task_id: taskId }).del();

      // Insert new associations
      if (label_ids.length > 0) {
        const now = new Date().toISOString();
        const inserts = label_ids.map(labelId => ({
          task_id: taskId,
          label_id: labelId,
          created_at: now,
          updated_at: now
        }));
        await trx('task_labels').insert(inserts);
      }
    });

    // Return updated labels
    const labels = await req.db('task_labels')
      .join('labels', 'task_labels.label_id', 'labels.id')
      .where('task_labels.task_id', taskId)
      .select('labels.id', 'labels.name')
      .orderBy('labels.id', 'asc');

    res.json(labels);
  } catch (err) {
    console.error('Erro ao definir labels da tarefa:', err);
    res.status(500).json({ error: 'errors.internal.generic' });
  }
};
