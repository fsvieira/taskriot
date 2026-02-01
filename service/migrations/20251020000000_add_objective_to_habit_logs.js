export async function up(knex) {
  const exists = await knex.schema.hasColumn('habit_logs', 'objective');
  if (!exists) {
    await knex.schema.alterTable('habit_logs', (table) => {
      table.integer('objective').defaultTo(1);
    });
  }
}

export async function down(knex) {
  const exists = await knex.schema.hasColumn('habit_logs', 'objective');
  if (exists) {
    await knex.schema.alterTable('habit_logs', (table) => {
      table.dropColumn('objective');
    });
  }
}