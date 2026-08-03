export const buildChecklist = (items, parentId = null, indent = '') => {
  const direct = items.filter(t => t.parent_id === parentId);
  return direct.map(t => {
    const state = t.is_recurring
      ? `[${t.current_counter >= t.objective ? 'x' : ' '}]`
      : `[${t.completed ? 'x' : ' '}]`;
    const base = `${indent}- ${state} ${t.title}`;
    const childBlock = buildChecklist(items, t.id, `${indent}  `);
    return childBlock.length ? `${base}\n${childBlock.join('\n')}` : base;
  });
};

export const generateTaskMarkdown = ({ ancestorPath, items, rootId }) => {
  let checklistItems = buildChecklist(items, rootId);
  if (checklistItems.length === 0 && rootId != null) {
    const rootTask = items.find(t => t.id === rootId);
    if (rootTask) {
      const state = rootTask.is_recurring
        ? `[${rootTask.current_counter >= rootTask.objective ? 'x' : ' '}]`
        : `[${rootTask.completed ? 'x' : ' '}]`;
      checklistItems = [`- ${state} ${rootTask.title}`];
    }
  }
  const checklist = checklistItems.join('\n');
  const pathLine = ancestorPath ? `${ancestorPath.replace(/ *> */g, ' -> ')}\n\n` : '';
  return `# Task Context\n\n${pathLine}## TODOS\n\n${checklist}`;
};
