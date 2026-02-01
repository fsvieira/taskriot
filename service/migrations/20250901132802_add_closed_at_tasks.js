export async function up(knex) {
  await knex.schema.alterTable('tasks', table => {
    table.string('state').notNullable().defaultTo('open'); // novo campo para estado da tarefa
    table.timestamp('closed_at').nullable(); // novo campo para data de fecho
  });
}

export async function down(knex) {
  await knex.schema.alterTable('tasks', table => {
    table.dropColumn('state');
    table.dropColumn('closed_at');
  });
}
