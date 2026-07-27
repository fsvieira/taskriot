export const up = async (knex) => {
  await knex.schema.createTable('project_schedules', (table) => {
    table.increments('id').primary();
    table.integer('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    table.integer('month_index').notNullable(); // 0=Jan ... 11=Dez
    table.integer('week').notNullable(); // 1..4
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['project_id', 'month_index', 'week']);
  });
};

export const down = async (knex) => {
  await knex.schema.dropTableIfExists('project_schedules');
};