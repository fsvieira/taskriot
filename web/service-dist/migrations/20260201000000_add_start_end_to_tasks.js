export function up(knex) {
  return knex.schema.table('tasks', (table) => {
    table.timestamp('start');
    table.timestamp('end');
  });
}

export function down(knex) {
  return knex.schema.table('tasks', (table) => {
    table.dropColumn('start');
    table.dropColumn('end');
  });
}
