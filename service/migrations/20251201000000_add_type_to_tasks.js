export function up(knex) {
  return knex.schema.alterTable('tasks', table => {
    table
      .enu('type', ['TASK', 'VISION', 'GOAL'])
      .defaultTo('TASK')
      .notNullable();
  });
}

export function down(knex) {
  return knex.schema.alterTable('tasks', table => {
    table.dropColumn('type');
  });
}
