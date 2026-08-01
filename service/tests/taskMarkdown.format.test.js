import { generateTaskMarkdown } from '../src/utils/taskMarkdown.js';

const items = [
  { id: 1, parent_id: null, title: 'Projeto', completed: false, is_recurring: false, objective: 1, current_counter: 0 },
  { id: 2, parent_id: 1, title: 'Tarefa A', completed: false, is_recurring: false, objective: 1, current_counter: 0 },
  { id: 3, parent_id: 2, title: 'Subtarefa A1', completed: false, is_recurring: false, objective: 1, current_counter: 0 },
  { id: 4, parent_id: 1, title: 'Tarefa B', completed: false, is_recurring: false, objective: 1, current_counter: 0 },
];

const markdown = generateTaskMarkdown({ ancestorPath: 'Projeto > Tarefa A', items, rootId: 2 });

console.log('MARKDOWN:\n' + markdown + '\n');

let passed = true;
const assertions = [];

if (markdown.startsWith('# Task Context') && markdown.includes('Projeto -> Tarefa A')) {
  assertions.push('Título fixo e caminho com -> presente.');
} else {
  passed = false;
  assertions.push('FALHA: título fixo ou caminho ausente/incorreto.');
}

if (/^## TODOS$/m.test(markdown)) {
  assertions.push('Seção ## TODOS presente.');
} else {
  passed = false;
  assertions.push('FALHA: seção ## TODOS ausente.');
}

const checklist = markdown.split('## TODOS')[1] || '';
if (checklist.includes('- [ ] Subtarefa A1') && !checklist.includes('Tarefa B')) {
  assertions.push('Checklist inclui apenas filhos diretos e netos, sem irmãos.');
} else {
  passed = false;
  assertions.push('FALHA: checklist com formato incorreto.');
}

console.log(assertions.join('\n'));

process.exit(passed ? 0 : 1);
