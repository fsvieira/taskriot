export async function up(knex) {
  await knex.schema.alterTable('tasks', table => {
    table.integer('depth').notNullable().defaultTo(1);
  });
}

export async function down(knex) {
  await knex.schema.alterTable('tasks', table => {
    table.dropColumn('depth');
  });
}
