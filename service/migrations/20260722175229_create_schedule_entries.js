/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
  return knex.schema.createTable('schedule_entries', table => {
    table.increments('id');
    table.integer('task_id').unsigned().notNullable().references('id').inTable('tasks').onDelete('CASCADE');
    table.date('date');
    table.time('start_time');
    table.time('end_time');
    table.boolean('is_recurring').defaultTo(false);
    table.enu('recurrence_type', ['daily', 'weekly', 'monthly']);
    table.integer('day_of_week'); // 0-6 for weekly
    table.integer('day_of_month'); // 1-31 for monthly
    table.timestamps(true, true);
    
    table.index('task_id');
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
  return knex.schema.dropTable('schedule_entries');
}