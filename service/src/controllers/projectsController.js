export const getAllProjects = async (req, res) => {
  const projects = await req.db('projects').select();

  // Add emotional averages
  const enrichedProjects = await Promise.all(projects.map(async (project) => {
    try {
      const indicators = await req.db('project_emotional_indicators as pei')
        .select('pei.indicator', 'pei.value')
        .join(
          req.db('project_emotional_indicators as sub')
            .select('indicator')
            .max('id as max_id')
            .where('sub.project_id', project.id)
            .groupBy('indicator')
            .as('sub'),
          'pei.id',
          'sub.max_id'
        );

      const latestIndicators = {};
      indicators.forEach(ind => {
        latestIndicators[ind.indicator] = ind.value;
      });

      const values = [latestIndicators[1] ?? 2, latestIndicators[2] ?? 2, latestIndicators[3] ?? 2];
      const average = values.reduce((sum, val) => sum + val, 0) / values.length;
      return { ...project, emotional_average: Math.round(average) };
    } catch (err) {
      return { ...project, emotional_average: 2 };
    }
  }));

  res.json(enrichedProjects);
};

export const createProject = async (req, res) => {
  try {
    const {
      name,
      state = 'active'
    } = req.body;

    const [project_id] = await req.db('projects').insert({
      name,
      state
    });

    // Create root task automatically
    await req.db('tasks').insert({
      project_id,
      parent_id: null,
      title: name,  // root task has the same name as the project
      completed: false,
      position: 0
    });

    res.status(201).json({ id: project_id });
  } catch (err) {
    console.error('Erro ao criar projeto:', err);
    res.status(500).json({ error: 'errors.internal.createProject' });
  }
};


export const updateProject = async (req, res) => {
  const { id } = req.params;
  const {
    name,
    state
  } = req.body;

  await req.db('projects').where({ id }).update({
    name,
    state
  });

  res.sendStatus(200);
};

export const deleteProject = async (req, res) => {
  const { id } = req.params;

  try {
    await req.db.transaction(async (trx) => {
      // First delete all tasks of the project
      await trx('tasks').where({ project_id: id }).del();

      // Then delete all related sessions
      await trx('project_sessions').where({ project_id: id }).del();

      // Finally, delete the project
      await trx('projects').where({ id }).del();
    });

    res.sendStatus(200);
  } catch (err) {
    console.error('Erro ao apagar projeto:', err);
    res.status(500).json({ error: 'errors.internal.deleteProject' });
  }
};


export const __getTodoList = async (req, res) => {
  const db = req.db;
  const { id: project_id } = req.params;

  try {
    // 1. Get maximum depth with incomplete tasks
    const [{ max_depth }] = await db('tasks')
      .where({ project_id, completed: false })
      .max('depth as max_depth');

    if (!max_depth) return res.json({ parent_id: null });

    // 2. Get all parents at this level and count active children
    const rows = await db('tasks')
      .select('parent_id')
      .count('* as active_children')
      .where({ project_id, completed: false })
      .andWhere('depth', max_depth)
      .whereNotNull('parent_id') // 👈 aqui está certo
      .groupBy('parent_id');

    if (rows.length === 0) return res.json({ parent_id: null });

    // 3. Find the minimum number of active children
    const minCount = Math.min(...rows.map(r => r.active_children));
    const candidates = rows.filter(r => r.active_children === minCount);

    // 4. Choose a random parent among the candidates
    const selected = candidates[Math.floor(Math.random() * candidates.length)];

    res.json({ parent_id: selected.parent_id });

  } catch (err) {
    console.error('Erro ao calcular próxima tarefa da queue:', err);
    res.status(500).json({ error: 'errors.internal.calculateNextTask' });
  }
};

export const getTodoList = async (req, res) => {
  const db = req.db;
  const { id: project_id } = req.params;

  try {
    // 1. Get minimum depth with incomplete tasks (excluding root)
    const [{ min_depth }] = await db('tasks')
      .where({ project_id, completed: false })
      .andWhereNot('parent_id', null)
      .min('depth as min_depth');

    if (!min_depth) return res.json({ parent_id: null });

    // 2. Get all parents at this level and count active children that are NOT parents (leaves)
    const rows = await db('tasks as t')
      .select('t.parent_id')
      .count('* as active_leaf_children')
      .where('t.project_id', project_id)
      .andWhere('t.completed', false)
      .andWhere('t.depth', min_depth)
      .whereNotNull('t.parent_id')
      .whereNotExists(
        db('tasks as child')
          .whereRaw('child.parent_id = t.id')
      )
      .groupBy('t.parent_id');

    if (rows.length === 0) return res.json({ parent_id: null });

    // 3. Find the minimum number of active children (leaves)
    const minCount = Math.min(...rows.map(r => r.active_leaf_children));
    const candidates = rows.filter(r => r.active_leaf_children === minCount);

    // 4. Choose a random parent among the candidates
    const selected = candidates[Math.floor(Math.random() * candidates.length)];

    res.json({ parent_id: selected.parent_id });

  } catch (err) {
    console.error('Erro ao calcular próxima tarefa da queue (shallow):', err);
    res.status(500).json({ error: 'errors.internal.calculateNextTaskShallow' });
  }
};

export const getEmotionalIndicators = async (req, res) => {
  const { id: project_id } = req.params;

  try {
    // Get the latest indicators using join with max id subquery
    const indicators = await req.db('project_emotional_indicators as pei')
      .select('pei.indicator', 'pei.value')
      .join(
        req.db('project_emotional_indicators as sub')
          .select('indicator')
          .max('id as max_id')
          .where('sub.project_id', parseInt(project_id))
          .groupBy('indicator')
          .as('sub'),
        'pei.id',
        'sub.max_id'
      );

    // Build latest indicators object
    const latestIndicators = {};
    indicators.forEach(ind => {
      latestIndicators[ind.indicator] = ind.value;
    });

    // Calculate average, default to 2 if no indicators
    const values = [latestIndicators[1] ?? 2, latestIndicators[2] ?? 2, latestIndicators[3] ?? 2];
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    const roundedAverage = Math.round(average);

    res.json({
      indicators: latestIndicators,
      average: roundedAverage
    });
  } catch (err) {
    console.error('Erro ao buscar indicadores emocionais:', err);
    res.status(500).json({ error: 'errors.internal.getEmotionalIndicators' });
  }
};

export const saveEmotionalIndicators = async (req, res) => {
  const { id: project_id } = req.params;
  const { indicators } = req.body; // array of { indicator: 1|2|3, value: 1|2|3 }

  try {
    const inserts = indicators.map(ind => ({
      project_id: parseInt(project_id),
      indicator: ind.indicator,
      value: ind.value
    }));

    await req.db('project_emotional_indicators').insert(inserts);

    res.status(201).json({ message: 'Emotional indicators saved successfully' });
  } catch (err) {
    console.error('Erro ao salvar indicadores emocionais:', err);
    res.status(500).json({ error: 'errors.internal.saveEmotionalIndicators' });
  }
};
