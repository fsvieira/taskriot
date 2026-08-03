const buildChecklist = (items, parentId, depth = 1) => {
  const indent = '  '.repeat(depth - 1);
  const lines = [];

  for (const task of items.filter(t => t.parent_id === parentId)) {
    const state = task.is_recurring
      ? `[${task.current_counter >= task.objective ? 'x' : ' '}]`
      : `[${task.completed ? 'x' : ' '}]`;
    lines.push(`${indent}${state} ${task.title}`);

    const childLines = buildChecklist(items, task.id, depth + 1);
    if (childLines.length) {
      lines.push(...childLines);
    }
  }

  return lines;
};

export const generateTaskMarkdown = ({ ancestorPath, items, rootId }) => {
  const lines = [];

  if (ancestorPath) {
    lines.push('# Task Context');
    lines.push('');
    lines.push(ancestorPath);
    lines.push('');
  }

  const checklist = buildChecklist(items, Number(rootId));
  lines.push('## TODO');
  lines.push('');

  if (checklist.length) {
    lines.push(...checklist);
  } else {
    const rootTask = items.find(t => t.id === Number(rootId));
    if (rootTask) {
      const state = rootTask.is_recurring
        ? `[${rootTask.current_counter >= rootTask.objective ? 'x' : ' '}]`
        : `[${rootTask.completed ? 'x' : ' '}]`;
      lines.push(`${state} ${rootTask.title}`);
    }
  }

  return lines.join('\n');
};
