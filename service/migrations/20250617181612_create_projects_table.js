export async function up(knex) {
  await knex.schema.createTable('projects', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.integer('daily_min').notNullable();     // horas ?
    table.integer('daily_max').notNullable();     // horas ?
    table.integer('weekly_days').notNullable();   // dias
    table.integer('monthly_weeks').notNullable(); // semanas
    table.enu('state', ['active', 'paused', 'inactive', 'completed', 'archived'])
      .notNullable()
      .defaultTo('active');
    table.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('projects');
}
