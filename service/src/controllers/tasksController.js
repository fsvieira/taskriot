import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore.js';
import isoWeek from 'dayjs/plugin/isoWeek.js';
dayjs.extend(isSameOrBefore);
dayjs.extend(isoWeek);

export const createTask = async (req, res) => {
  const io = req.io;
  try {
    const {
      project_id,
      parent_id = null,
      title,
      type = 'TASK',
      completed = false,
      position = 0,
      is_recurring = false,
      recurrence_type,
      objective
    } = req.body;

    if (!project_id || !title) {
      return res.status(400).json({ error: 'errors.tasks.projectIdAndTitleRequired' });
    }

    if (is_recurring && (!recurrence_type || !objective)) {
      return res.status(400).json({ error: 'errors.tasks.recurrenceFieldsRequired' });
    }

    let depth = 1;
    if (parent_id) {
      const parent = await req.db('tasks').where({ id: parent_id }).first();
      if (!parent) {
        return res.status(400).json({ error: 'errors.tasks.invalidParentId' });
      }
      depth = parent.depth + 1;
    }

    // Calculate position to be at the beginning
    const siblingsQuery = req.db('tasks').where({ project_id, parent_id });
    const minPosition = await siblingsQuery.min('position as minPos').first();
    const calculatedPosition = minPosition.minPos !== null ? minPosition.minPos - 1 : 0;

    const now = dayjs().toISOString();
    const today = dayjs().format('YYYY-MM-DD');

    const [id] = await req.db('tasks').insert({
      project_id,
      parent_id,
      title,
      type,
      completed,
      position: calculatedPosition,
      depth,
      is_recurring,
      recurrence_type,
      objective,
      current_counter: is_recurring ? 0 : null,
      last_reset: is_recurring ? today : null,
      created_at: now,
      updated_at: now
    });

    // Emit stats update
    io.emit('stats-update');

    res.status(201).json({ id });
  } catch (err) {
    console.error('Erro ao criar tarefa:', err);
    res.status(500).json({ error: 'errors.internal.createTask' });
  }
};


// === Get tasks subtree ===
// Recursive helper function to build the tree
const buildTaskTree = (allTasks, parentId = null) => {
  return allTasks
    .filter(t => t.parent_id === parentId)
    .map(t => {
      const subtasks = buildTaskTree(allTasks, t.id);
      let percent_closed;
      if (t.is_recurring) {
        percent_closed = t.objective > 0 ? Math.round((t.current_counter / t.objective) * 100) : 0;
      } else {
        const totalSubtasks = subtasks.length;
        const closedSubtasks = subtasks.filter(st => st.is_recurring ? (st.current_counter >= st.objective) : st.completed).length;
        const total = totalSubtasks + 1;
        const closed = closedSubtasks + (t.completed ? 1 : 0);
        percent_closed = total > 0 ? Math.round((closed / total) * 100) : 0;
      }

      return {
        ...t,
        subtasks,
        percent_closed
      };
    });
};

export const getTaskWithChildren = async (req, res) => {
  const { projectId, taskId } = req.params;

  try {

    // Fetch all tasks of the project
    const tasks = await req.db('tasks')
      .where({ project_id: projectId })
      .orderBy('position', 'asc');

    if (!tasks.length) return res.status(404).json({ error: 'errors.tasks.noTasksFound' });

    // Check and reset recurring tasks
    const now = dayjs();
    const today = now.format('YYYY-MM-DD');
    for (const task of tasks) {
      if (task.is_recurring) {
        let needsReset = false;
        if (task.last_reset) {
          const lastReset = dayjs(task.last_reset);
          if (task.recurrence_type === 'daily' && !lastReset.isSame(now, 'day')) {
            needsReset = true;
          } else if (task.recurrence_type === 'weekly' && !lastReset.isSame(now, 'isoWeek')) {
            needsReset = true;
          } else if (task.recurrence_type === 'monthly' && !lastReset.isSame(now, 'month')) {
            needsReset = true;
          }
        } else {
          // Tasks without last_reset need initialization
          needsReset = true;
        }

        if (needsReset) {
          console.log(`Resetting task ${task.id}: last_reset=${task.last_reset}, current_counter=${task.current_counter}, needsReset=${needsReset}`);
          // Log previous counter if > 0 and had last_reset
          if (task.last_reset && task.current_counter > 0) {
            console.log(`Logging habit for task ${task.id}: counter_value=${task.current_counter}, objective=${task.objective}`);
            await req.db('habit_logs').insert({
              task_id: task.id,
              date: dayjs().toISOString(),
              counter_value: task.current_counter,
              objective: task.objective, // Adicionar objective ao log
              created_at: dayjs().toISOString(),
              updated_at: dayjs().toISOString()
            });
          }
          // Reset
          await req.db('tasks').where({ id: task.id }).update({
            current_counter: 0,
            last_reset: today,
            updated_at: dayjs().toISOString()
          });
          task.current_counter = 0;
          task.last_reset = today;
        }
      }
    }

    const rootId = taskId != null ? Number(taskId) : tasks.find(t => t.parent_id === null)?.id;

    if (!rootId) return res.status(404).json({ error: 'errors.tasks.rootTaskNotFound' });

    const taskMap = Object.fromEntries(tasks.map(t => [t.id, t]));
    const root = taskMap[rootId];

    const tree = {
      ...root,
      subtasks: buildTaskTree(tasks, rootId)
    };

    // Calculate percent_closed for root
    const totalSubtasks = tree.subtasks.length;
    const closedSubtasks = tree.subtasks.filter(st => st.is_recurring ? (st.current_counter >= st.objective) : st.completed).length;
    const total = totalSubtasks + 1;
    const closed = closedSubtasks + (tree.completed ? 1 : 0);
    tree.percent_closed = total > 0 ? Math.round((closed / total) * 100) : 0;

    res.json(tree);
  } catch (err) {
    console.error('Erro ao buscar tarefas:', err);
    res.status(500).json({ error: 'errors.internal.fetchTasks' });
  }
};


export const deleteTaskRecursively = async (req, res) => {
  const io = req.io;
  const { taskId } = req.params;

  if (!taskId) {
    return res.status(400).json({ error: 'errors.tasks.taskIdRequired' });
  }

  try {
    await req.db.transaction(async (trx) => {
      // Find the target task
      const task = await trx('tasks').where({ id: taskId }).first();

      if (!task) {
        return res.status(404).json({ error: 'errors.tasks.taskNotFound' });
      }

      if (task.parent_id === null) {
        return res.status(403).json({ error: 'errors.tasks.cannotDeleteRoot' });
      }

      // Fetch all tasks (within the transaction)
      const allTasks = await trx('tasks');

      // Recursive function to find descendants
      const collectDescendants = (id) => {
        const children = allTasks.filter(t => t.parent_id === id);
        return children.flatMap(child => [child.id, ...collectDescendants(child.id)]);
      };

      // Collect IDs to delete (children + the task itself)
      const idsToDelete = collectDescendants(task.id);
      idsToDelete.push(task.id);

      // Delete
      await trx('tasks').whereIn('id', idsToDelete).del();

      res.status(200).json({ deleted: idsToDelete });
    });

    // Emit stats update
    io.emit('stats-update');
  } catch (err) {
    console.error('Erro ao apagar tarefas:', err);
    res.status(500).json({ error: 'errors.internal.deleteTasks' });
  }
};

export const updateTask = async (req, res) => {
  const io = req.io;
  const { taskId } = req.params;
  const updates = req.body;

  try {
    // Fetch the current state of the task
    const task = await req.db('tasks').where({ id: taskId }).first();
    if (!task) {
      return res.status(404).json({ error: 'errors.tasks.taskNotFound' });
    }

    const now = dayjs().toISOString();
    const { increment_counter, ...otherUpdates } = updates;
    let baseUpdates = { ...otherUpdates, updated_at: now };

    // Handle increment for recurring tasks
    if (increment_counter && task.is_recurring) {
      console.log(`Incrementing counter for task ${task.id}: ${task.current_counter || 0} -> ${(task.current_counter || 0) + 1}`);
      baseUpdates.current_counter = (task.current_counter || 0) + 1;

      // Log each increment immediately for habit tracking
      console.log(`Logging increment for task ${task.id}: counter_value=1, objective=${task.objective}`);
      await req.db('habit_logs').insert({
        task_id: task.id,
        date: dayjs().toISOString(),
        counter_value: 1, // Log 1 for each increment
        objective: task.objective,
        created_at: dayjs().toISOString(),
        updated_at: dayjs().toISOString()
      });
    }

    // Logic to close task (only for non-recurring)
    if (!task.is_recurring) {
      const willClose =
        (typeof baseUpdates.completed !== 'undefined' && !task.completed && baseUpdates.completed === true) ||
        (typeof baseUpdates.state !== 'undefined' && task.state !== 'closed' && baseUpdates.state === 'closed');

      if (willClose) {
        baseUpdates.closed_at = now;
        if (typeof baseUpdates.state === 'undefined') baseUpdates.state = 'closed';
        if (typeof baseUpdates.completed === 'undefined') baseUpdates.completed = true;
      }

      // Logic to reopen task (optional)
      const willReopen =
        (typeof baseUpdates.completed !== 'undefined' && task.completed && baseUpdates.completed === false) ||
        (typeof baseUpdates.state !== 'undefined' && task.state === 'closed' && baseUpdates.state !== 'closed');

      if (willReopen) {
        baseUpdates.closed_at = null;
        if (typeof baseUpdates.state === 'undefined') baseUpdates.state = 'open';
        if (typeof baseUpdates.completed === 'undefined') baseUpdates.completed = false;
      }
    }

    // Detect parent_id change (need to recalculate depth and validate tree)
    const parentProvided = Object.prototype.hasOwnProperty.call(baseUpdates, 'parent_id');
    const newParentId = parentProvided ? baseUpdates.parent_id : task.parent_id;
    const hasParentChange = parentProvided && newParentId !== task.parent_id;

    if (hasParentChange) {
      if (Number(taskId) === Number(newParentId)) {
        return res.status(400).json({ error: 'errors.tasks.cannotBeOwnParent' });
      }

      // Fetch all tasks of the project to validate and calculate descendants
      const allTasks = await req.db('tasks').where({ project_id: task.project_id });

      // Determine descendants of the current task
      const collectDescendants = (id) => {
        const children = allTasks.filter(t => t.parent_id === id);
        return children.flatMap(child => [child.id, ...collectDescendants(child.id)]);
      };
      const descendants = collectDescendants(task.id);

      if (newParentId != null) {
        if (descendants.includes(newParentId)) {
          return res.status(400).json({ error: 'errors.tasks.cannotMoveToDescendant' });
        }
        const parent = allTasks.find(t => t.id === newParentId);
        if (!parent) {
          return res.status(400).json({ error: 'errors.tasks.invalidParentId' });
        }
      }

      const newDepth = newParentId == null ? 1 : (allTasks.find(t => t.id === newParentId).depth + 1);
      const depthDelta = newDepth - task.depth;

      await req.db.transaction(async (trx) => {
        // Update the task itself (including parent_id and depth)
        const result = await trx('tasks')
          .where({ id: taskId })
          .update({ ...baseUpdates, depth: newDepth });

        if (result === 0) {
          throw new Error('Task not found');
        }

        // Propagate depth change to descendants
        if (depthDelta !== 0 && descendants.length > 0) {
          await trx('tasks')
            .whereIn('id', descendants)
            .update({
              depth: trx.raw('depth + ?', [depthDelta]),
              updated_at: now
            });
        }
      });

      // Emit stats update
      io.emit('stats-update');

      return res.json({ success: true });
    }

    // No parent change: simple update
    const result = await req.db('tasks')
      .where({ id: taskId })
      .update(baseUpdates);

    if (result === 0) {
      return res.status(404).json({ error: 'errors.tasks.taskNotFound' });
    }

    // Emit stats update
    io.emit('stats-update');

    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao fazer update da task:', err);
    res.status(500).json({ error: 'errors.internal.generic' });
  }
};

export const getAllRecurringTasks = async (req, res) => {
  try {
    // Fetch all recurring tasks with project info
    const tasks = await req.db('tasks')
      .join('projects', 'tasks.project_id', 'projects.id')
      .where('tasks.is_recurring', true)
      .select(
        'tasks.*',
        'projects.name as project_name',
        'projects.habits_order as project_habits_order'
      )
      .orderBy('projects.habits_order', 'asc')
      .orderBy('projects.id', 'asc');

    // Check and reset recurring tasks
    const now = dayjs();
    const today = now.format('YYYY-MM-DD');
    for (const task of tasks) {
      let needsReset = false;
      if (task.last_reset) {
        const lastReset = dayjs(task.last_reset);
        if (task.recurrence_type === 'daily' && !lastReset.isSame(now, 'day')) {
          needsReset = true;
        } else if (task.recurrence_type === 'weekly' && !lastReset.isSame(now, 'isoWeek')) {
          needsReset = true;
        } else if (task.recurrence_type === 'monthly' && !lastReset.isSame(now, 'month')) {
          needsReset = true;
        }
      } else {
        // Tasks without last_reset need initialization
        needsReset = true;
      }

      if (needsReset) {
        console.log(`Resetting task ${task.id}: last_reset=${task.last_reset}, current_counter=${task.current_counter}, needsReset=${needsReset}`);
        // Log previous counter if > 0 and had last_reset
        if (task.last_reset && task.current_counter > 0) {
          console.log(`Logging habit for task ${task.id}: counter_value=${task.current_counter}, objective=${task.objective}`);
          await req.db('habit_logs').insert({
            task_id: task.id,
            date: dayjs().toISOString(),
            counter_value: task.current_counter,
            objective: task.objective, // Adicionar objective ao log
            created_at: dayjs().toISOString(),
            updated_at: dayjs().toISOString()
          });
        }
        // Reset
        await req.db('tasks').where({ id: task.id }).update({
          current_counter: 0,
          last_reset: today,
          updated_at: dayjs().toISOString()
        });
        task.current_counter = 0;
        task.last_reset = today;
      }
      // Calculate percent_closed for habits display
      task.percent_closed = task.objective > 0 ? Math.round((task.current_counter / task.objective) * 100) : 0;
    }

    // Group by project
    const projectsMap = {};
    tasks.forEach(task => {
      if (!projectsMap[task.project_id]) {
        projectsMap[task.project_id] = {
          id: task.project_id,
          name: task.project_name,
          habits_order: task.project_habits_order ?? 0,
          tasks: []
        };
      }
      projectsMap[task.project_id].tasks.push(task);
    });

    // Sort tasks within each project by persisted habits_order only (UI will push "done" to bottom)
    Object.values(projectsMap).forEach(project => {
      project.tasks.sort((a, b) => {
        const ao = (a.habits_order ?? 0);
        const bo = (b.habits_order ?? 0);
        if (ao !== bo) return ao - bo;
        return a.id - b.id;
      });
    });

    const projects = Object.values(projectsMap).sort((a, b) => {
      const ao = (a.habits_order ?? 0);
      const bo = (b.habits_order ?? 0);
      if (ao !== bo) return ao - bo;
      return a.id - b.id;
    });

    res.json({ projects });
  } catch (err) {
    console.error('Erro ao buscar hábitos:', err);
    res.status(500).json({ error: 'errors.internal.fetchHabits' });
  }
};

export const updateHabitsProjectsOrder = async (req, res) => {
  try {
    const { projectIds } = req.body;
    if (!Array.isArray(projectIds) || projectIds.length === 0) {
      return res.status(400).json({ error: 'errors.projects.projectIdsRequired' });
    }

    await req.db.transaction(async (trx) => {
      for (let i = 0; i < projectIds.length; i++) {
        const id = projectIds[i];
        await trx('projects').where({ id }).update({
          habits_order: i,
          updated_at: trx.fn.now()
        });
      }
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('Erro ao atualizar ordem de projetos (hábitos):', err);
    return res.status(500).json({ error: 'errors.internal.updateProjectsOrder' });
  }
};

export const updateHabitsTasksOrder = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { taskIds } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'errors.tasks.taskIdRequired' });
    }
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: 'errors.tasks.taskIdsRequired' });
    }

    // Validate that all taskIds belong to this project and are recurring
    const tasks = await req.db('tasks')
      .whereIn('id', taskIds)
      .andWhere({ project_id: projectId, is_recurring: true });

    if (tasks.length !== taskIds.length) {
      return res.status(400).json({ error: 'errors.tasks.tasksInvalidForHabitReorder' });
    }

    await req.db.transaction(async (trx) => {
      for (let i = 0; i < taskIds.length; i++) {
        const id = taskIds[i];
        await trx('tasks').where({ id }).update({
          habits_order: i,
          updated_at: trx.fn.now()
        });
      }
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('Erro ao atualizar ordem de tasks (hábitos):', err);
    return res.status(500).json({ error: 'errors.internal.updateTasksOrder' });
  }
};

export const closeTaskRecursively = async (req, res) => {
  const io = req.io;
  const { taskId } = req.params;

  if (!taskId) {
    return res.status(400).json({ error: 'errors.tasks.taskIdRequired' });
  }

  try {
    await req.db.transaction(async (trx) => {
      // Find the target task
      const task = await trx('tasks').where({ id: taskId }).first();

      if (!task) {
        return res.status(404).json({ error: 'errors.tasks.taskNotFound' });
      }

      // Fetch all tasks (within the transaction)
      const allTasks = await trx('tasks');

      // Recursive function to find descendants
      const collectDescendants = (id) => {
        const children = allTasks.filter(t => t.parent_id === id);
        return children.flatMap(child => [child.id, ...collectDescendants(child.id)]);
      };

      // Collect IDs to close (children + the task itself)
      const idsToClose = collectDescendants(task.id);
      idsToClose.push(task.id);

      const now = dayjs().toISOString();

      // Update all tasks
      await trx('tasks')
        .whereIn('id', idsToClose)
        .update({
          completed: true,
          state: 'closed',
          closed_at: now,
          updated_at: now
        });

      res.status(200).json({ closed: idsToClose.length });
    });

    // Emit stats update
    io.emit('stats-update');
  } catch (err) {
    console.error('Erro ao fechar tarefas recursivamente:', err);
    res.status(500).json({ error: 'errors.internal.closeTasksRecursively' });
  }
};