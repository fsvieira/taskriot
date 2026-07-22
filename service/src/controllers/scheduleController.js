import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek.js';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore.js';
dayjs.extend(isoWeek);
dayjs.extend(isSameOrBefore);

// === CRUD Schedule Entries ===

export const createSchedule = async (req, res) => {
  try {
    const { taskId } = req.params;
    const {
      date,
      start_time,
      end_time,
      is_recurring,
      recurrence_type,
      day_of_week,
      day_of_month
    } = req.body;

    // Verify task exists
    const task = await req.db('tasks').where({ id: taskId }).first();
    if (!task) {
      return res.status(404).json({ error: 'errors.tasks.taskNotFound' });
    }

    const now = dayjs().toISOString();
    const [id] = await req.db('schedule_entries').insert({
      task_id: taskId,
      date: date || null,
      start_time: start_time || null,
      end_time: end_time || null,
      is_recurring: is_recurring || false,
      recurrence_type: recurrence_type || null,
      day_of_week: day_of_week ?? null,
      day_of_month: day_of_month ?? null,
      created_at: now,
      updated_at: now
    });

    res.status(201).json({ id });
  } catch (err) {
    console.error('Erro ao criar schedule:', err);
    res.status(500).json({ error: 'errors.internal.generic' });
  }
};

export const updateSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const {
      date,
      start_time,
      end_time,
      is_recurring,
      recurrence_type,
      day_of_week,
      day_of_month
    } = req.body;

    const existing = await req.db('schedule_entries').where({ id: scheduleId }).first();
    if (!existing) {
      return res.status(404).json({ error: 'errors.schedules.notFound' });
    }

    const now = dayjs().toISOString();
    const updates = {
      updated_at: now
    };
    if (date !== undefined) updates.date = date || null;
    if (start_time !== undefined) updates.start_time = start_time || null;
    if (end_time !== undefined) updates.end_time = end_time || null;
    if (is_recurring !== undefined) updates.is_recurring = is_recurring;
    if (recurrence_type !== undefined) updates.recurrence_type = recurrence_type || null;
    if (day_of_week !== undefined) updates.day_of_week = day_of_week ?? null;
    if (day_of_month !== undefined) updates.day_of_month = day_of_month ?? null;

    await req.db('schedule_entries').where({ id: scheduleId }).update(updates);

    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao atualizar schedule:', err);
    res.status(500).json({ error: 'errors.internal.generic' });
  }
};

export const deleteSchedule = async (req, res) => {
  try {
    const { scheduleId } = req.params;

    const existing = await req.db('schedule_entries').where({ id: scheduleId }).first();
    if (!existing) {
      return res.status(404).json({ error: 'errors.schedules.notFound' });
    }

    await req.db('schedule_entries').where({ id: scheduleId }).del();

    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao apagar schedule:', err);
    res.status(500).json({ error: 'errors.internal.generic' });
  }
};

export const getTaskSchedules = async (req, res) => {
  try {
    const { taskId } = req.params;

    const schedules = await req.db('schedule_entries')
      .where({ task_id: taskId })
      .orderBy('date', 'asc')
      .orderBy('start_time', 'asc');

    res.json(schedules);
  } catch (err) {
    console.error('Erro ao buscar schedules:', err);
    res.status(500).json({ error: 'errors.internal.generic' });
  }
};

// === Helper: resolve schedule entries for a given date ===

/**
 * Given a list of schedule entries and a date, returns those that apply to that date.
 * For recurring schedules, resolves them against the date.
 */
const resolveSchedulesForDate = (schedules, dateStr) => {
  const date = dayjs(dateStr);
  const dayOfWeek = date.day(); // 0=Sunday, 6=Saturday
  const dayOfMonth = date.date();

  return schedules.filter(s => {
    if (s.is_recurring) {
      // Recurring schedule
      if (s.recurrence_type === 'daily') {
        return true;
      } else if (s.recurrence_type === 'weekly') {
        return s.day_of_week === dayOfWeek;
      } else if (s.recurrence_type === 'monthly') {
        return s.day_of_month === dayOfMonth;
      }
      return false;
    } else {
      // Non-recurring: must match date exactly
      if (!s.date) return false;
      const sDate = dayjs(s.date);
      return sDate.isSame(date, 'day');
    }
  });
};

// === Helper: find leftmost open (recurring or uncompleted) leaf task, or leftmost child if none are open ===

const findActiveLeafOrCompletionLeaf = (tasks, parentId) => {
  const children = tasks.filter(t => t.parent_id === parentId).sort((a, b) => a.position - b.position);

  if (children.length === 0) return null;

  const firstChild = children[0];

  if (firstChild.is_recurring) {
    const grandchildren = tasks.filter(t => t.parent_id === firstChild.id);
    const hasOpen = grandchildren.some(g => {
      if (g.is_recurring)       return g.current_counter < g.objective;
      return !g.completed;
    });
    if (hasOpen) {
      const leaf = findActiveLeafOrCompletionLeaf(tasks, firstChild.id);
      if (leaf) return leaf;
    }
    return firstChild;
  }

  const hasSubtasks = tasks.some(t => t.parent_id === firstChild.id);
  if (!hasSubtasks) return firstChild;

  const hasOpen = tasks.some(t => t.parent_id === firstChild.id && !t.completed);
  if (hasOpen) {
    const leaf = findActiveLeafOrCompletionLeaf(tasks, firstChild.id);
    if (leaf) return leaf;
  }

  return firstChild;
};

// === Helper: build path from root to a task ===

const buildTaskPath = (tasks, taskId) => {
  const path = [];
  let currentId = taskId;
  
  while (currentId) {
    const task = tasks.find(t => t.id === currentId);
    if (!task) break;
    path.unshift({ id: task.id, title: task.title });
    currentId = task.parent_id;
  }
  
  return path;
};

// === Main Planner Endpoint ===

export const getPlanner = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || dayjs().format('YYYY-MM-DD');
    const now = dayjs();
    const currentTime = now.format('HH:mm');
    const currentMinutes = timeToMinutes(currentTime);

    // Fetch all schedule entries and their tasks
    const schedules = await req.db('schedule_entries')
      .select(
        'schedule_entries.*',
        'tasks.project_id',
        'tasks.title as task_title',
        'tasks.completed',
        'tasks.is_recurring',
        'tasks.current_counter',
        'tasks.objective',
        'tasks.parent_id as task_parent_id',
        'projects.name as project_name'
      )
      .join('tasks', 'schedule_entries.task_id', 'tasks.id')
      .join('projects', 'tasks.project_id', 'projects.id')
      .orderBy('schedule_entries.start_time', 'asc');

    // Resolve schedules for the target date
    const resolved = resolveSchedulesForDate(schedules, targetDate);

    // For each resolved schedule, determine status and full task tree context
    const entries = [];

    for (const sched of resolved) {
      // Determine status
      let status;
      if (sched.start_time && sched.end_time) {
        const startMinutes = timeToMinutes(sched.start_time);
        const endMinutes = timeToMinutes(sched.end_time);
        
        if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
          status = 'active';
        } else if (currentMinutes > endMinutes) {
          const diff = currentMinutes - endMinutes;
          if (diff <= 30) {
            status = 'recent';
          } else {
            continue;
          }
        } else if (currentMinutes < startMinutes) {
          status = 'upcoming';
        }
      } else {
        status = currentTime >= '00:00' ? 'active' : 'upcoming';
      }

      // Get the scheduled task's full project tasks for tree context
      const allProjectTasks = await req.db('tasks')
        .where({ project_id: sched.project_id })
        .orderBy('position', 'asc');

      const targetTask = findActiveLeafOrCompletionLeaf(allProjectTasks, sched.task_id);
      const targetTaskId = targetTask ? targetTask.id : sched.task_id;
      const parentChain = buildTaskPath(allProjectTasks, targetTaskId);

      const targetTaskInfo = allProjectTasks.find(t => t.id === targetTaskId) || sched;
      const displayPath = parentChain.length > 1
        ? parentChain.slice(0, -1).map(t => t.title).join(' → ')
        : '';

      entries.push({
        schedule_id: sched.id,
        task_id: targetTaskId,
        start_time: sched.start_time || '00:00',
        end_time: sched.end_time || '23:59',
        status,
        project_id: sched.project_id,
        project_name: sched.project_name,
        task_title: targetTask ? targetTask.title : sched.task_title,
        is_recurring: targetTaskInfo.is_recurring,
        current_counter: targetTaskInfo.current_counter,
        objective: targetTaskInfo.objective,
        completed: targetTaskInfo.completed,
        do_task: targetTask ? {
          id: targetTask.id,
          title: targetTask.title,
          completed: targetTask.completed,
          is_recurring: targetTask.is_recurring,
          current_counter: targetTask.current_counter,
          objective: targetTask.objective
        } : null,
        parent_chain: parentChain,
        path: displayPath
      });
    }

    // Sort by start_time
    entries.sort((a, b) => a.start_time.localeCompare(b.start_time));

    res.json({
      date: targetDate,
      entries
    });
  } catch (err) {
    console.error('Erro ao buscar planner:', err);
    res.status(500).json({ error: 'errors.internal.generic' });
  }
};

// Helper: convert HH:mm to total minutes
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}