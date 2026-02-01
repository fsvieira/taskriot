export async function up(knex) {
  await knex.schema.createTable('project_sessions', (table) => {
    table.uuid('id').primary();
    table.integer('project_id').unsigned().notNullable();
    table.integer('task_time_ms').notNullable();
    table.timestamp('start_counter').notNullable();
    table.timestamp('end_counter').nullable();

    table
      .foreign('project_id')
      .references('id')
      .inTable('projects')
      .onDelete('CASCADE');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('project_sessions');
}
