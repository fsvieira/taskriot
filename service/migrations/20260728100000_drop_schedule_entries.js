export const up = async (knex) => {
  await knex.schema.dropTableIfExists('schedule_entries');
};

export const down = async (knex) => {
  await knex.schema.createTable('schedule_entries', (table) => {
    table.increments('id').primary();
    table.integer('task_id').notNullable().references('id').inTable('tasks').onDelete('CASCADE');
    table.date('date').nullable();
    table.string('start_time', 5).nullable();
    table.string('end_time', 5).nullable();
    table.boolean('is_recurring').notNullable().defaultTo(false);
    table.string('recurrence_type', 20).nullable();
    table.integer('day_of_week').nullable();
    table.integer('day_of_month').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });
};