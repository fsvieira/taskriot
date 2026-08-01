import dayjs from 'dayjs';

// === Helper: calculate week of month (1-4, clamped) ===
function getMonthWeek(date) {
  const firstDay = date.startOf('month');
  const diff = date.diff(firstDay, 'day');
  return Math.min(Math.floor(diff / 7) + 1, 4);
}

// === Helper: find leftmost open (recurring or uncompleted) leaf task, or leftmost child if none are open ===

const findActiveLeafOrCompletionLeaf = (tasks, parentId) => {
  const children = tasks.filter(t => t.parent_id === parentId).sort((a, b) => a.position - b.position);

  if (children.length === 0) return null;

  for (const child of children) {
    const isDone = child.is_recurring ? (child.current_counter || 0) >= child.objective : child.completed;

    if (isDone) {
      continue;
    }

    if (child.is_recurring) {
      const grandchildren = tasks.filter(t => t.parent_id === child.id);
      const hasOpen = grandchildren.some(g => {
        if (g.is_recurring) return g.current_counter < g.objective;
        return !g.completed;
      });
      if (hasOpen) {
        const leaf = findActiveLeafOrCompletionLeaf(tasks, child.id);
        if (leaf) return leaf;
      }
      return child;
    }

    const hasSubtasks = tasks.some(t => t.parent_id === child.id);
    if (!hasSubtasks) return child;

    const hasOpen = tasks.some(t => t.parent_id === child.id && !t.completed);
    if (hasOpen) {
      const leaf = findActiveLeafOrCompletionLeaf(tasks, child.id);
      if (leaf) return leaf;
    }

    return child;
  }

  return null;
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

// === Main Planner Endpoint (labels only) ===

export const getPlanner = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || dayjs().format('YYYY-MM-DD');
    const now = dayjs();
    const currentTime = now.format('HH:mm');
    const currentMinutes = timeToMinutes(currentTime);

    // Fetch project schedules for filtering (month + week)
    const targetMonth = dayjs(targetDate).month(); // 0-11
    const targetWeek = getMonthWeek(dayjs(targetDate));
    const activeProjectSchedules = await req.db('project_schedules')
      .where({ month_index: targetMonth, week: targetWeek })
      .select('project_id');
    const activeProjectIds = new Set(activeProjectSchedules.map(ps => ps.project_id));

    // Fetch matching label schedules for the target date
    const dayOfWeek = dayjs(targetDate).day();
    const labelSchedules = await req.db('label_schedules')
      .join('labels', 'label_schedules.label_id', 'labels.id')
      .where('label_schedules.day_of_week', dayOfWeek)
      .select(
        'label_schedules.id',
        'label_schedules.label_id',
        'labels.name as label_name',
        'label_schedules.start_time',
        'label_schedules.end_time'
      );

    // Process label-scheduled tasks
    const entries = [];

    for (const ls of labelSchedules) {
      const tasksWithLabel = await req.db('task_labels')
        .join('tasks', 'task_labels.task_id', 'tasks.id')
        .join('projects', 'tasks.project_id', 'projects.id')
        .where('task_labels.label_id', ls.label_id)
        .select(
          'tasks.id',
          'tasks.project_id',
          'tasks.title',
          'tasks.completed',
          'tasks.is_recurring',
          'tasks.current_counter',
          'tasks.objective',
          'tasks.parent_id',
          'projects.name as project_name'
        );

      for (const task of tasksWithLabel) {
        // Filter by project schedule: only show if project is active for this month+week
        if (!activeProjectIds.has(task.project_id)) continue;

        const allProjectTasks = await req.db('tasks')
          .where({ project_id: task.project_id })
          .orderBy('position', 'asc');

        const targetTask = findActiveLeafOrCompletionLeaf(allProjectTasks, task.id);
        const targetTaskId = targetTask ? targetTask.id : task.id;
        const parentChain = buildTaskPath(allProjectTasks, targetTaskId);

        const targetTaskInfo = allProjectTasks.find(t => t.id === targetTaskId) || task;
        if (targetTaskInfo.is_recurring && (targetTaskInfo.current_counter || 0) >= targetTaskInfo.objective) {
          continue;
        }

        const displayPath = parentChain.length > 1
          ? parentChain.slice(0, -1).map(t => t.title).join(' → ')
          : '';

        const closedSiblings = allProjectTasks
          .filter(t => {
            const updated = dayjs(t.updated_at);
            return t.completed && t.id !== targetTaskId && updated.isAfter(dayjs().subtract(8, 'hour'));
          })
          .sort((a, b) => dayjs(b.updated_at).unix() - dayjs(a.updated_at).unix())
          .slice(0, 3)
          .map(t => ({
            id: t.id,
            title: t.title,
            is_recurring: t.is_recurring,
          }));

        let status;
        const todayStr = now.format('YYYY-MM-DD');

        if (targetDate < todayStr) {
          status = 'recent';
        } else if (targetDate > todayStr) {
          status = 'upcoming';
        } else {
          const startMinutes = timeToMinutes(ls.start_time);
          const endMinutes = timeToMinutes(ls.end_time);

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
        }

        entries.push({
          schedule_id: `label-${ls.id}-${task.id}`,
          task_id: targetTaskId,
          start_time: ls.start_time || '00:00',
          end_time: ls.end_time || '23:59',
          status,
          project_id: task.project_id,
          project_name: task.project_name,
          task_title: targetTask ? targetTask.title : task.title,
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
          path: displayPath,
          recently_closed_siblings: closedSiblings,
          label_id: ls.label_id,
          label_name: ls.label_name
        });
      }
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