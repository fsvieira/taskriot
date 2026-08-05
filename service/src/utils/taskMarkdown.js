const buildChecklist = (items, parentId, depth = 1) => {
  const indent = '  '.repeat(depth - 1);
  const lines = [];

  for (const task of items.filter(t => t.parent_id === parentId)) {
    const checkbox = task.completed ? 'X' : ' ';
    lines.push(`${indent}* [${checkbox}] ${task.title}`);

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

  lines.push('## TODO');
  lines.push('');

  const rootTask = items.find(t => t.id === Number(rootId));
  if (rootTask) {
    const checkbox = rootTask.completed ? 'X' : ' ';
    lines.push(`* [${checkbox}] ${rootTask.title}`);
  }

  const checklist = buildChecklist(items, Number(rootId), 2);
  if (checklist.length) {
    lines.push(...checklist);
  }

  return lines.join('\n');
};
