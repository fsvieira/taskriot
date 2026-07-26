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