import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import isoWeek from 'dayjs/plugin/isoWeek.js';
dayjs.extend(utc);
dayjs.extend(isoWeek);

export const getProjectStats = async (req, res) => {
  const db = req.db;

  // Usa datas ISO para garantir compatibilidade com a base de dados
  const today = dayjs().utc().startOf('day').toISOString();
  const monday = dayjs().utc().startOf('isoWeek').toISOString();
  const startOfMonth = dayjs().utc().startOf('month').toISOString();
  const now = dayjs().utc().toISOString();

  try {
    const rows = await db('project_sessions')
      .select('project_id')
      .groupBy('project_id')
      .select(
        db.raw(`
          SUM(
            CASE WHEN start_counter >= ? AND start_counter < ? AND end_counter IS NOT NULL
              THEN (julianday(end_counter) - julianday(start_counter)) * 24.0
              ELSE 0 END
          ) AS timeToday,
          SUM(
            CASE WHEN start_counter >= ? AND start_counter < ? AND end_counter IS NOT NULL
              THEN (julianday(end_counter) - julianday(start_counter)) * 24.0
              ELSE 0 END
          ) AS timeThisWeek,
          SUM(
            CASE WHEN start_counter >= ? AND start_counter < ? AND end_counter IS NOT NULL
              THEN (julianday(end_counter) - julianday(start_counter)) * 24.0
              ELSE 0 END
          ) AS timeThisMonth,
          SUM(
            CASE WHEN end_counter IS NOT NULL
              THEN (julianday(end_counter) - julianday(start_counter)) * 24.0
              ELSE 0 END
          ) AS timeTotal
        `, [
          today, now,      // timeToday
          monday, now,     // timeThisWeek
          startOfMonth, now // timeThisMonth
        ])
      );

    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar estatísticas:", err);
    res.status(500).json({ error: "errors.internal.fetchStats" });
  }
};

export const getDailyTimeStats = async (req, res) => {
  const db = req.db;
  const days = parseInt(req.query.days) || 30;

  const startDate = dayjs().utc().subtract(days - 1, 'day').startOf('day').toISOString();
  const now = dayjs().utc().toISOString();

  try {
    const rows = await db('project_sessions')
      .select(
        db.raw(`DATE(start_counter) as date`)
      )
      .where('start_counter', '>=', startDate)
      .where('start_counter', '<', now)
      .whereNotNull('end_counter')
      .select(
        db.raw(`SUM((julianday(end_counter) - julianday(start_counter)) * 24.0) as hours`)
      )
      .groupBy(db.raw(`DATE(start_counter)`))
      .orderBy('date');

    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar estatísticas diárias:", err);
    res.status(500).json({ error: "errors.internal.fetchDailyStats" });
  }
};

export const getHabitsStats = async (req, res) => {
  const db = req.db;
  const days = parseInt(req.query.days) || 30;
  const range = (req.query.range || 'week').toLowerCase();

  // Set start date based on range
  const now = dayjs().utc();
  const startDate = now.startOf('year').format('YYYY-MM-DD');

  try {
    const rows = await db('habit_logs')
      .join('tasks', 'habit_logs.task_id', 'tasks.id')
      .select('habit_logs.date', 'tasks.title', 'habit_logs.counter_value')
      .where('habit_logs.date', '>=', startDate)
      .orderBy('habit_logs.date')
      .orderBy('tasks.title');

    // Group by date and task
    const grouped = {};
    rows.forEach(row => {
      if (!grouped[row.date]) grouped[row.date] = {};
      grouped[row.date][row.title] = (grouped[row.date][row.title] || 0) + row.counter_value;
    });

    // For different ranges, aggregate differently using SQL
    let result;
    if (range === 'day') {
      // Group by habit, then by hour (0-23), calculate sum(counter) / adjusted_objective per habit per hour
      const rows = await db('habit_logs')
        .join('tasks', 'habit_logs.task_id', 'tasks.id')
        .select('tasks.title', 'tasks.recurrence_type')
        .select(db.raw(`strftime('%H', habit_logs.date) as hour`))
        .select(db.raw(`SUM(habit_logs.counter_value) as total_counter`))
        .select(db.raw(`AVG(habit_logs.objective) as avg_objective`))
        .where('habit_logs.date', '>=', startDate)
        .groupBy('tasks.title', 'tasks.recurrence_type', db.raw(`strftime('%H', habit_logs.date)`))
        .orderBy('tasks.title', 'hour');

      // Transform to expected format: {habit: "name", hours: [0, 0, ..., percentage, ...]}
      const habitGroups = {};
      rows.forEach(row => {
        const habit = row.title;
        const hour = parseInt(row.hour);
        const totalCounter = parseFloat(row.total_counter) || 0;
        const avgObjective = parseFloat(row.avg_objective) || 1;

        // Adjust objective based on recurrence type for day view
        let adjustedObjective = avgObjective;
        // For day view, we don't divide - we keep the original objective
        // Only multiply for higher frequency tasks if needed, but for day view we show daily progress

        const percentage = adjustedObjective > 0 ? totalCounter / adjustedObjective : 0;

        if (!habitGroups[habit]) {
          habitGroups[habit] = { habit, hours: Array(24).fill(0) };
        }
        habitGroups[habit].hours[hour] = percentage;
      });

      result = Object.values(habitGroups);
    } else if (range === 'week') {
      // Group by day of week for current week, calculate sum(counter) / adjusted_objective per habit per day
      const rows = await db('habit_logs')
        .join('tasks', 'habit_logs.task_id', 'tasks.id')
        .select('tasks.title', 'tasks.recurrence_type')
        .select(db.raw(`strftime('%w', habit_logs.date) as day`))
        .select(db.raw(`SUM(habit_logs.counter_value) as total_counter`))
        .select(db.raw(`AVG(habit_logs.objective) as avg_objective`))
        .where('habit_logs.date', '>=', startDate)
        .groupBy('tasks.title', 'tasks.recurrence_type', db.raw(`strftime('%w', habit_logs.date)`))
        .orderBy('tasks.title', 'day');

      // Transform to expected format: {habit: "name", days: [0, 0, ..., percentage, ...]}
      const habitGroups = {};
      rows.forEach(row => {
        const habit = row.title;
        const day = parseInt(row.day);
        const totalCounter = parseFloat(row.total_counter) || 0;
        const avgObjective = parseFloat(row.avg_objective) || 1;

        // Adjust objective based on recurrence type for week view
        let adjustedObjective = avgObjective;
        // For week view showing days, keep original objective for all tasks

        const percentage = adjustedObjective > 0 ? totalCounter / adjustedObjective : 0;

        if (!habitGroups[habit]) {
          habitGroups[habit] = { habit, days: Array(7).fill(0) };
        }
        habitGroups[habit].days[day] = percentage;
      });

      result = Object.values(habitGroups);
    } else if (range === 'month') {
      // Group by week of month for current month, calculate sum(counter) / adjusted_objective per habit per week
      const rows = await db('habit_logs')
        .join('tasks', 'habit_logs.task_id', 'tasks.id')
        .select('tasks.title', 'tasks.recurrence_type')
        .select(db.raw(`CAST((strftime('%d', habit_logs.date) - 1) / 7 + 1 AS INTEGER) as week`))
        .select(db.raw(`SUM(habit_logs.counter_value) as total_counter`))
        .select(db.raw(`AVG(habit_logs.objective) as avg_objective`))
        .where('habit_logs.date', '>=', startDate)
        .groupBy('tasks.title', 'tasks.recurrence_type', db.raw(`CAST((strftime('%d', habit_logs.date) - 1) / 7 + 1 AS INTEGER)`))
        .orderBy('tasks.title', 'week');

      // Transform to expected format: {habit: "name", weeks: [0, 0, ..., percentage, ...]}
      const habitGroups = {};
      rows.forEach(row => {
        const habit = row.title;
        const week = parseInt(row.week) - 1; // weeks are 1-5, convert to 0-4 for array index
        const totalCounter = parseFloat(row.total_counter) || 0;
        const avgObjective = parseFloat(row.avg_objective) || 1;

        // Adjust objective based on recurrence type for month view
        let adjustedObjective = avgObjective;
        if (row.recurrence_type === 'daily') adjustedObjective = avgObjective * 7; // Daily tasks in a week (since month view shows weeks)
        // For weekly and monthly tasks in month view showing weeks, keep original objective

        const percentage = adjustedObjective > 0 ? totalCounter / adjustedObjective : 0;

        if (!habitGroups[habit]) {
          habitGroups[habit] = { habit, weeks: Array(5).fill(0) }; // Max 5 weeks in a month
        }
        if (week >= 0 && week < 5) {
          habitGroups[habit].weeks[week] = percentage;
        }
      });

      result = Object.values(habitGroups);
    } else if (range === 'year') {
      // Group by month for current year, calculate sum(counter) / adjusted_objective per habit per month
      const rows = await db('habit_logs')
        .join('tasks', 'habit_logs.task_id', 'tasks.id')
        .select('tasks.title', 'tasks.recurrence_type')
        .select(db.raw(`strftime('%m', habit_logs.date) as month`))
        .select(db.raw(`SUM(habit_logs.counter_value) as total_counter`))
        .select(db.raw(`AVG(habit_logs.objective) as avg_objective`))
        .where('habit_logs.date', '>=', startDate)
        .groupBy('tasks.title', 'tasks.recurrence_type', db.raw(`strftime('%m', habit_logs.date)`))
        .orderBy('tasks.title', 'month');

      // Transform to expected format: {habit: "name", months: [0, 0, ..., percentage, ...]}
      const habitGroups = {};
      rows.forEach(row => {
        const habit = row.title;
        const month = parseInt(row.month) - 1; // months are 1-12, convert to 0-11 for array index
        const totalCounter = parseFloat(row.total_counter) || 0;
        const avgObjective = parseFloat(row.avg_objective) || 1;

        // Adjust objective based on recurrence type for year view
        let adjustedObjective = avgObjective;
        if (row.recurrence_type === 'daily') adjustedObjective = avgObjective * 30; // Daily tasks in a month (since year view shows months)
        if (row.recurrence_type === 'weekly') adjustedObjective = avgObjective * 4.3; // Weekly tasks in a month (since year view shows months)
        // For monthly tasks in year view showing months, keep original objective

        const percentage = adjustedObjective > 0 ? totalCounter / adjustedObjective : 0;

        if (!habitGroups[habit]) {
          habitGroups[habit] = { habit, months: Array(12).fill(0) };
        }
        habitGroups[habit].months[month] = percentage;
      });

      result = Object.values(habitGroups);
    } else {
      // Default: by date
      result = Object.keys(grouped).sort().map(date => ({
        date,
        ...grouped[date]
      }));
    }

    res.json(result);
  } catch (err) {
    console.error("Erro ao buscar estatísticas de hábitos:", err);
    res.status(500).json({ error: "errors.internal.fetchHabitStats" });
  }
};

export const getTimeByProjectStats = async (req, res) => {
  const db = req.db;
  const range = (req.query.range || 'week').toLowerCase();
  const year = parseInt(req.query.year) || dayjs().year();

  try {
    // Set time window
    const currentYear = dayjs().year();
    const isCurrentYear = year === currentYear;
    const now = dayjs().utc();
    let start, end;
    switch (range) {
      case 'day':
        start = dayjs().year(year).startOf('day');
        end = isCurrentYear ? now : dayjs().year(year).endOf('day');
        break;
      case 'week':
        start = dayjs().year(year).startOf('isoWeek');
        end = isCurrentYear ? now : dayjs().year(year).endOf('isoWeek');
        break;
      case 'month':
        start = dayjs().year(year).startOf('month');
        end = isCurrentYear ? now : dayjs().year(year).endOf('month');
        break;
      case 'year':
        start = dayjs().year(year).startOf('year');
        end = isCurrentYear ? now : dayjs().year(year).endOf('year');
        break;
      default:
        start = dayjs().year(year).startOf('week');
        end = isCurrentYear ? now : dayjs().year(year).endOf('week');
        break;
    }
    const startISO = start.toISOString();
    const nowISO = end.toISOString();

    const rows = await db('project_sessions')
      .select('project_id')
      .join('projects', 'project_sessions.project_id', 'projects.id')
      .select(
        'projects.name',
        db.raw(`SUM((julianday(end_counter) - julianday(start_counter)) * 24.0) as hours`)
      )
      .where('start_counter', '>=', startISO)
      .where('start_counter', '<', nowISO)
      .whereNotNull('end_counter')
      .groupBy('project_id', 'projects.name')
      .orderBy('hours', 'desc')
      .limit(10);

    const result = rows.map(row => ({
      name: row.name,
      hours: Math.round(row.hours * 10) / 10, // 1 decimal
    }));

    res.json(result);
  } catch (err) {
    console.error("Erro ao buscar tempo por projeto:", err);
    res.status(500).json({ error: "errors.internal.fetchTimeByProject" });
  }
};

export const getCompletedTasksStats = async (req, res) => {
  const db = req.db;
  const days = parseInt(req.query.days) || 30;

  const startDate = dayjs().utc().subtract(days - 1, 'day').startOf('day').toISOString();

  try {
    const rows = await db('tasks')
      .select(db.raw(`DATE(closed_at) as date`))
      .count('* as count')
      .where('closed_at', '>=', startDate)
      .groupBy(db.raw(`DATE(closed_at)`))
      .orderBy('date');

    res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar estatísticas de tarefas concluídas:", err);
    res.status(500).json({ error: "errors.internal.fetchCompletedTasksStats" });
  }
};


// KPIs endpoint: active/total projects, focusMinutes, tasksCompleted, habitsSuccessRate
/**
 * Weekly open vs closed tasks since start of year.
 * open = tasks that exist (created_at <= week_end) and not closed by week_end (closed_at is null or > week_end)
 * closed = tasks closed within the week window (week_start <= closed_at & closed_at <= week_end)
 */
export const getOpenClosedWeekly = async (req, res) => {
  const db = req.db;

  try {
    const now = dayjs().utc();

    // Optional filter by project_id
    const projectId = req.query.projectId ? Number(req.query.projectId) : null;

    // Fetch minimal task fields (filtered if projectId provided)
    let query = db('tasks')
      .select('id', 'project_id', 'is_recurring', 'created_at', 'updated_at', 'completed', 'state', 'closed_at');

    if (projectId) {
      query = query.where({ project_id: projectId });
    }

    // Ignore recurring tasks (is_recurring = false or null)
    query = query.andWhere(function () {
      this.whereNull('is_recurring').orWhere('is_recurring', false);
    });

    const rows = await query;

    if (!rows || rows.length === 0) {
      return res.json([]);
    }

    // Preprocess to Dayjs and infer closedAt when missing but appears closed
    const tasks = rows.map(r => {
      const createdAt = r.created_at ? dayjs(r.created_at).utc() : null;
      const appearsClosed = (r.completed === true) || (r.state === 'closed');
      const closedAt = r.closed_at ? dayjs(r.closed_at).utc()
        : (appearsClosed && r.updated_at ? dayjs(r.updated_at).utc() : null);
      return { createdAt, closedAt };
    });

    // Detect earliest data point (first creation or closure)
    const dates = [];
    for (const t of tasks) {
      if (t.createdAt) dates.push(t.createdAt);
      if (t.closedAt) dates.push(t.closedAt);
    }
    if (dates.length === 0) {
      return res.json([]);
    }
    let earliest = dates[0];
    for (const d of dates) {
      if (d.isBefore(earliest)) earliest = d;
    }
    const timelineStart = earliest.startOf('isoWeek');

    // Build weeks from the first data week to now (UTC, ISO weeks)
    const weeks = [];
    let cursor = timelineStart;
    while (cursor.isBefore(now, 'week') || cursor.isSame(now, 'week')) {
      const weekStart = cursor;
      const weekEnd = cursor.endOf('isoWeek');
      weeks.push({ start: weekStart, end: weekEnd });
      cursor = cursor.add(1, 'week');
    }

    // Compute time per week in MINUTES using the same ISO-week bucketing as above
    // This avoids mismatches between SQLite week formats and Day.js isoWeek labels
    const sessions = await db('project_sessions')
      .select('project_id', 'start_counter', 'end_counter')
      // Include any session that overlaps the chart window:
      // end_counter >= timelineStart AND start_counter < now
      .where('end_counter', '>=', timelineStart.toISOString())
      .andWhere('start_counter', '<', now.toISOString())
      .whereNotNull('end_counter')
      .modify(q => {
        if (projectId) q.where({ project_id: projectId });
      });

    const minutesByWeek = new Map();
    sessions.forEach(s => {
      const sStart = dayjs(s.start_counter).utc();
      const sEnd = dayjs(s.end_counter).utc();

      // Distribute session duration across ISO weeks by overlap to avoid assigning
      // entire multi-day sessions to a single week.
      let cursor = sStart.startOf('isoWeek');
      const lastWeek = sEnd.startOf('isoWeek');

      while (cursor.isBefore(lastWeek) || cursor.isSame(lastWeek)) {
        const weekStart = cursor;
        const weekEnd = cursor.endOf('isoWeek');

        // Overlap within this week
        const overlapStart = sStart.isAfter(weekStart) ? sStart : weekStart;
        const overlapEnd = sEnd.isBefore(weekEnd) ? sEnd : weekEnd;

        const overlapMin = Math.max(0, overlapEnd.diff(overlapStart, 'minute'));
        if (overlapMin > 0) {
          const wkKey = `${weekStart.isoWeekYear()}-${String(weekStart.isoWeek()).padStart(2, '0')}`;
          minutesByWeek.set(wkKey, (minutesByWeek.get(wkKey) || 0) + overlapMin);
        }

        cursor = cursor.add(1, 'week');
      }
    });


    const data = weeks.map(({ start, end }) => {
      const open = tasks.reduce((acc, t) => {
        if (!t.createdAt) return acc;
        const createdLEEnd = t.createdAt.isBefore(end) || t.createdAt.isSame(end);
        const stillOpenAtEnd = !t.closedAt || t.closedAt.isAfter(end);
        return acc + (createdLEEnd && stillOpenAtEnd ? 1 : 0);
      }, 0);

      // Cumulative closed count up to end of this week
      const closed = tasks.reduce((acc, t) => {
        if (!t.closedAt) return acc;
        const untilThisWeek = t.closedAt.isBefore(end) || t.closedAt.isSame(end);
        return acc + (untilThisWeek ? 1 : 0);
      }, 0);

      // Cumulative created count up to end of this week (tarefas existentes/criadas até ao momento)
      const created = tasks.reduce((acc, t) => {
        if (!t.createdAt) return acc;
        const untilThisWeek = t.createdAt.isBefore(end) || t.createdAt.isSame(end);
        return acc + (untilThisWeek ? 1 : 0);
      }, 0);

      const weekKey = `${start.isoWeekYear()}-${String(start.isoWeek()).padStart(2, '0')}`;

      return {
        week: weekKey,
        startISO: start.toISOString(),
        endISO: end.toISOString(),
        label: `${start.format('DD/MM')} - ${end.format('DD/MM')}`,
        open,
        closed,
        created,
        // Use computed minutes per week so tooltip can format 1d 10h 1m, etc.
        time: (minutesByWeek.get(weekKey) || 0) / 60
      };
    });

    return res.json(data);
  } catch (err) {
    console.error('Erro ao calcular abertos vs fechados (semanal):', err);
    return res.status(500).json({ error: 'errors.internal.calculateOpenVsClosed' });
  }
};

export const getProjectStability = async (req, res) => {
  const db = req.db;
  const projectId = Number(req.query.projectId);

  if (!projectId) {
    return res.status(400).json({ error: 'errors.projects.projectIdRequired' });
  }

  try {
    const now = dayjs().utc();

    // Detect earliest data point for this project
    const taskDates = await db('tasks')
      .where({ project_id: projectId })
      .andWhere(function () {
        this.whereNull('is_recurring').orWhere('is_recurring', false);
      })
      .select('created_at', 'closed_at', 'updated_at', 'completed', 'state')
      .whereNotNull('created_at');

    if (!taskDates || taskDates.length === 0) {
      return res.json({ timeVariationPercentage: 0, closedVariationPercentage: 0 });
    }

    const dates = [];
    taskDates.forEach(r => {
      if (r.created_at) dates.push(dayjs(r.created_at).utc());
      const appearsClosed = (r.completed === true) || (r.state === 'closed');
      const closedAt = r.closed_at ? dayjs(r.closed_at).utc()
        : (appearsClosed && r.updated_at ? dayjs(r.updated_at).utc() : null);
      if (closedAt) dates.push(closedAt);
    });

    if (dates.length === 0) {
      return res.json({ timeVariationPercentage: 0, closedVariationPercentage: 0 });
    }

    let earliest = dates[0];
    for (const d of dates) {
      if (d.isBefore(earliest)) earliest = d;
    }
    const timelineStart = earliest.startOf('isoWeek');

    // Build weeks
    const weeks = [];
    let cursor = timelineStart;
    while (cursor.isBefore(now, 'week') || cursor.isSame(now, 'week')) {
      const weekStart = cursor;
      const weekEnd = cursor.endOf('isoWeek');
      weeks.push({ start: weekStart, end: weekEnd });
      cursor = cursor.add(1, 'week');
    }

    // Tasks for this project
    const tasks = taskDates.map(r => {
      const createdAt = r.created_at ? dayjs(r.created_at).utc() : null;
      const appearsClosed = (r.completed === true) || (r.state === 'closed');
      const closedAt = r.closed_at ? dayjs(r.closed_at).utc()
        : (appearsClosed && r.updated_at ? dayjs(r.updated_at).utc() : null);
      return { createdAt, closedAt };
    });

    // Time per week
    const sessions = await db('project_sessions')
      .where({ project_id: projectId })
      .where('end_counter', '>=', timelineStart.toISOString())
      .andWhere('start_counter', '<', now.toISOString())
      .whereNotNull('end_counter')
      .select('start_counter', 'end_counter');

    const minutesByWeek = new Map();
    sessions.forEach(s => {
      const sStart = dayjs(s.start_counter).utc();
      const sEnd = dayjs(s.end_counter).utc();

      let cursor = sStart.startOf('isoWeek');
      const lastWeek = sEnd.startOf('isoWeek');

      while (cursor.isBefore(lastWeek) || cursor.isSame(lastWeek)) {
        const weekStart = cursor;
        const weekEnd = cursor.endOf('isoWeek');

        const overlapStart = sStart.isAfter(weekStart) ? sStart : weekStart;
        const overlapEnd = sEnd.isBefore(weekEnd) ? sEnd : weekEnd;

        const overlapMin = Math.max(0, overlapEnd.diff(overlapStart, 'minute'));
        if (overlapMin > 0) {
          const wkKey = `${weekStart.isoWeekYear()}-${String(weekStart.isoWeek()).padStart(2, '0')}`;
          minutesByWeek.set(wkKey, (minutesByWeek.get(wkKey) || 0) + overlapMin);
        }

        cursor = cursor.add(1, 'week');
      }
    });

    // Compute weekly data
    const weeklyData = [];
    weeks.forEach(({ start, end }, index) => {
      const open = tasks.reduce((acc, t) => {
        if (!t.createdAt) return acc;
        const createdLEEnd = t.createdAt.isBefore(end) || t.createdAt.isSame(end);
        const stillOpenAtEnd = !t.closedAt || t.closedAt.isAfter(end);
        return acc + (createdLEEnd && stillOpenAtEnd ? 1 : 0);
      }, 0);

      const closed = tasks.reduce((acc, t) => {
        if (!t.closedAt) return acc;
        const untilThisWeek = t.closedAt.isBefore(end) || t.closedAt.isSame(end);
        return acc + (untilThisWeek ? 1 : 0);
      }, 0);

      const weekKey = `${start.isoWeekYear()}-${String(start.isoWeek()).padStart(2, '0')}`;

      const weeklyClosed = index === 0 ? closed : closed - (weeklyData[index - 1]?.closed || 0);

      weeklyData.push({
        week: weekKey,
        open,
        closed,
        time: (minutesByWeek.get(weekKey) || 0) / 60, // hours
        weeklyClosed
      });
    });

    // Calculate averages
    const numWeeks = weeklyData.length;
    const avgTimePerWeek = numWeeks > 0 ? Math.ceil(weeklyData.reduce((sum, w) => sum + w.time, 0) / numWeeks) : 0;
    const avgClosedPerWeek = numWeeks > 0 ? Math.ceil(weeklyData.reduce((sum, w) => sum + w.weeklyClosed, 0) / numWeeks) : 0;

    // Calculate variations
    const timeVariationCount = weeklyData.filter(item => {
      const lowerBound = avgTimePerWeek * 0.9;
      const upperBound = avgTimePerWeek * 1.1;
      return item.time >= lowerBound && item.time <= upperBound;
    }).length;
    const timeVariationPercentage = numWeeks > 0 ? Math.round((timeVariationCount / numWeeks) * 100) : 0;

    const closedVariationCount = weeklyData.filter(item => {
      const lowerBound = avgClosedPerWeek * 0.9;
      const upperBound = avgClosedPerWeek * 1.1;
      return item.weeklyClosed >= lowerBound && item.weeklyClosed <= upperBound;
    }).length;
    const closedVariationPercentage = numWeeks > 0 ? Math.round((closedVariationCount / numWeeks) * 100) : 0;

    return res.json({
      timeVariationPercentage,
      closedVariationPercentage,
      avgTimePerWeek,
      avgClosedPerWeek,
      numWeeks
    });
  } catch (err) {
    console.error('Erro ao calcular estabilidade do projeto:', err);
    return res.status(500).json({ error: 'errors.internal.calculateProjectStability' });
  }
};

export const getTaskIncidenceByTime = async (req, res) => {
  const db = req.db;
  const dayOfWeekParam = req.query.dayOfWeek;
  const year = parseInt(req.query.year);
  const useLast30Days = req.query.last30days === 'true';

  let dayOfWeek;
  if (dayOfWeekParam !== undefined) {
    dayOfWeek = parseInt(dayOfWeekParam);
    if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return res.status(400).json({ error: 'Invalid dayOfWeek. Must be 0-6.' });
    }
  } else {
    // Default to today's day of the week if not provided
    dayOfWeek = dayjs().utc().day();
  }
  
  let startDate, endDate;

  if (useLast30Days) {
    // Use last 30 days from today
    startDate = dayjs().utc().subtract(30, 'days').startOf('day');
    endDate = dayjs().utc().endOf('day');
  } else if (year) {
    const currentYear = dayjs().utc().year();
    if (year === currentYear) {
      // Current year: last 30 days from today
      startDate = dayjs().utc().subtract(30, 'days').startOf('day');
      endDate = dayjs().utc().endOf('day');
    } else {
      // Past year: last 30 days of that year
      startDate = dayjs().utc().year(year).endOf('year').subtract(30, 'days').startOf('day');
      endDate = dayjs().utc().year(year).endOf('year');
    }
  } else {
      // Fallback to last 30 days to be safe.
      startDate = dayjs().utc().subtract(30, 'days').startOf('day');
      endDate = dayjs().utc().endOf('day');
  }

  const startISO = startDate.toISOString();
  const endISO = endDate.toISOString();

  console.log('Task Incidence: Using date range from', startISO, 'to', endISO, 'for dayOfWeek', dayOfWeek);

  try {
    // Get sessions in last 30 days on the specified day of week
    const allSessions = await db('project_sessions')
      .where('start_counter', '>=', startISO)
      .where('start_counter', '<=', endISO)
      .whereNotNull('end_counter')
      .select('start_counter', 'end_counter', 'project_id');

    // Get project names and emotional averages for coloring
    const projectIds = [...new Set(allSessions.map(session => session.project_id))];
    const projects = await db('projects')
      .whereIn('projects.id', projectIds)
      .leftJoin('project_emotional_indicators as pei', function() {
        this.on('projects.id', 'pei.project_id')
          .andOn('pei.id', db.raw('(SELECT MAX(id) FROM project_emotional_indicators WHERE project_id = projects.id)'));
      })
      .select('projects.id', 'projects.name')
      .select(db.raw('AVG(pei.value) as emotional_average'))
      .groupBy('projects.id', 'projects.name');
    
    const projectMap = new Map();
    const projectEmotionalMap = new Map();
    projects.forEach(p => {
      projectMap.set(p.id, p.name);
      projectEmotionalMap.set(p.id, Math.round(p.emotional_average || 2)); // Default to neutral (2) if no data
    });

    // Filter by day of week in JS
    const sessions = allSessions.filter(session => {
      const dow = dayjs(session.start_counter).utc().day(); // 0=Sunday
      return dow === dayOfWeek;
    });

    console.log('Task Incidence: Found', sessions.length, 'sessions for day', dayOfWeek);

    // Calculate weighting parameters
    const daysInPeriod = endDate.diff(startDate, 'day') + 1;

    // Initialize counts for 144 slots (24h * 6 slots per hour)
    const counts = new Array(144).fill(0);
    const projectCounts = new Array(144).fill(null).map(() => new Map());

    sessions.forEach(session => {
      const start = dayjs(session.start_counter).utc();
      const end = dayjs(session.end_counter).utc();

      // Calculate weight based on how old the session is (older = less weight)
      const sessionDate = start.startOf('day');
      const daysFromStart = sessionDate.diff(startDate, 'day');
      const weight = Math.max(0, 1 - (daysFromStart / daysInPeriod));

      // Compute minutes since midnight
      const startMinutes = start.hour() * 60 + start.minute();
      let endMinutes = end.hour() * 60 + end.minute();

      // If crosses midnight, truncate to midnight
      if (endMinutes < startMinutes) {
        endMinutes = 1440; // 24*60
      }

      // For each 10-min slot
      for (let i = 0; i < 144; i++) {
        const slotStart = i * 10;
        const slotEnd = (i + 1) * 10;
        // Count if session overlaps the slot
        if (startMinutes < slotEnd && endMinutes > slotStart) {
          counts[i] += weight;
          // Track project counts
          if (!projectCounts[i].has(session.project_id)) {
            projectCounts[i].set(session.project_id, 0);
          }
          projectCounts[i].set(session.project_id, projectCounts[i].get(session.project_id) + weight);
        }
      }
    });

    // Prepare data for chart
    const data = counts.map((count, i) => {
      const hours = Math.floor((i * 10) / 60);
      const minutes = (i * 10) % 60;
      const time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      
      // Find dominant project in this slot
      let dominantProjectId = null;
      let maxProjectWeight = 0;
      if (projectCounts[i].size > 0) {
        for (const [projectId, weight] of projectCounts[i].entries()) {
          if (weight > maxProjectWeight) {
            maxProjectWeight = weight;
            dominantProjectId = projectId;
          }
        }
      }

      // Calculate weighted average of emotional values for all projects in this slot
      let emotionalAverage = null;
      if (projectCounts[i].size > 0) {
        let totalWeight = 0;
        let totalEmotionalValue = 0;
        for (const [projectId, weight] of projectCounts[i].entries()) {
          const emotionalValue = projectEmotionalMap.get(projectId) || 2; // Default to neutral (2) if no data
          totalWeight += weight;
          totalEmotionalValue += weight * emotionalValue;
        }
        emotionalAverage = Math.round(totalEmotionalValue / totalWeight);
      }
      
      return { 
        time, 
        count, 
        dominantProjectId,
        dominantProject: dominantProjectId ? projectMap.get(dominantProjectId) : null,
        emotionalAverage: emotionalAverage
      };
    });

    // Calculate cycles
    const cycles = [];
    const startIndex = data.findIndex(d => d.count > 0);

    console.log('Calculating cycles for dayOfWeek', dayOfWeek, 'data length', data.length, 'startIndex', startIndex);

    if (startIndex !== -1) {
      const endIndex = data.length - 1 - [...data].reverse().findIndex(d => d.count > 0);
      const trimmedData = data.slice(startIndex, endIndex + 1);

      const totalCount = trimmedData.reduce((sum, d) => sum + d.count, 0);
      const average = totalCount / trimmedData.length;

      console.log('trimmedData length', trimmedData.length, 'average', average);

      let inCycle = false;
      let cycleStart = null;

      for (let i = startIndex; i <= endIndex; i++) {
        const point = data[i];

        // Cycles based on simple average
        if (point.count >= average && !inCycle) {
          inCycle = true;
          cycleStart = point.time;
        } else if (point.count < average && inCycle) {
          inCycle = false;
          cycles.push({ start: cycleStart, end: data[i - 1].time });
          cycleStart = null;
        }
      }

      if (inCycle) {
        cycles.push({ start: cycleStart, end: data[endIndex].time });
      }
    }

    console.log('Calculated cycles:', cycles);

    res.json({ data, cycles });
  } catch (err) {
    console.error('Erro ao calcular incidência de tarefas por tempo:', err);
    res.status(500).json({ error: 'errors.internal.calculateTaskIncidence' });
  }
};


export const getKpis = async (req, res) => {
  const db = req.db;
  const range = (req.query.range || 'week').toLowerCase();

  try {
    // Set time window
    const now = dayjs().utc();
    let start;
    switch (range) {
      case 'day':
        start = now.startOf('day');
        break;
      case 'week':
        start = now.startOf('isoWeek');
        break;
      case 'month':
        start = now.startOf('month');
        break;
      case 'year':
        start = now.startOf('year');
        break;
      default:
        start = now.startOf('week');
        break;
    }
    const startISO = start.toISOString();
    const nowISO = now.toISOString();
    const startDateStr = start.format('YYYY-MM-DD');

    // Projects counts
    const totalProjectsRow = await db('projects').count({ c: '*' }).first();
    const activeProjectsRow = await db('projects').where({ state: 'active' }).count({ c: '*' }).first();
    const totalProjects = Number(totalProjectsRow?.c || 0);
    const activeProjects = Number(activeProjectsRow?.c || 0);

    // Focus minutes from project_sessions within range
    const focusRow = await db('project_sessions')
      .where('start_counter', '>=', startISO)
      .where('start_counter', '<', nowISO)
      .whereNotNull('end_counter')
      .select(
        db.raw(`SUM((julianday(end_counter) - julianday(start_counter)) * 24.0) as hours`)
      )
      .first();
    const focusMinutes = Math.round((Number(focusRow?.hours) || 0) * 60);

    // Tasks completed within range
    const tasksCompletedRow = await db('tasks')
      .whereNotNull('closed_at')
      .where('closed_at', '>=', startISO)
      .where('closed_at', '<', nowISO)
      .count({ c: '*' })
      .first();
    const tasksCompleted = Number(tasksCompletedRow?.c || 0);

    // Habits success rate within range
    // Success from logs inside range (past periods)
    const logs = await db('habit_logs')
      .join('tasks', 'habit_logs.task_id', 'tasks.id')
      .where('habit_logs.date', '>=', startDateStr)
      .select(
        'habit_logs.task_id',
        'habit_logs.date',
        'habit_logs.counter_value',
        'habit_logs.objective'
      );

    let logsTotal = logs.length;
    let logsSuccess = logs.reduce((acc, l) => {
      const objective = Number(l.objective || 1);
      const val = Number(l.counter_value || 0);
      return acc + (val >= objective ? 1 : 0);
    }, 0);

    // Current ongoing periods that started inside the range: consider current_counter vs objective
    const currentPeriodTasks = await db('tasks')
      .where({ is_recurring: true })
      .andWhere('last_reset', '>=', startDateStr)
      .select('id', 'current_counter', 'objective');

    const currentTotal = currentPeriodTasks.length;
    const currentSuccess = currentPeriodTasks.reduce((acc, t) => {
      const objective = Number(t.objective || 1);
      const val = Number(t.current_counter || 0);
      return acc + (val >= objective ? 1 : 0);
    }, 0);

    const habitDaysTotal = logsTotal + currentTotal;
    const habitDaysSuccess = logsSuccess + currentSuccess;
    const habitsSuccessRate = habitDaysTotal > 0 ? Math.round((habitDaysSuccess / habitDaysTotal) * 100) : 0;

    return res.json({
      range,
      totalProjects,
      activeProjects,
      focusMinutes,
      tasksCompleted,
      habitsSuccessRate
    });
  } catch (err) {
    console.error('Erro ao calcular KPIs:', err);
    return res.status(500).json({ error: 'errors.internal.calculateKpis' });
  }
};
