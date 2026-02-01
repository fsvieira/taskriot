export async function up(knex) {
  await knex.schema.alterTable('project_sessions', table => {
    table.dropColumn('task_time_ms');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('project_sessions', table => {
    table.integer('task_time_ms').notNullable();
  });
}
