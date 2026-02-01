export async function up(knex) {
  await knex.schema.alterTable('projects', (table) => {
    table.dropColumn('daily_min');
    table.dropColumn('daily_max');
    table.dropColumn('weekly_days');
    table.dropColumn('monthly_weeks');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('projects', (table) => {
    table.integer('daily_min').notNullable();
    table.integer('daily_max').notNullable();
    table.integer('weekly_days').notNullable();
    table.integer('monthly_weeks').notNullable();
  });
}
