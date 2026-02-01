/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
  return knex.schema.alterTable('tasks', table => {
    table.boolean('is_recurring').defaultTo(false);
    table.enu('recurrence_type', ['daily', 'weekly', 'monthly']);
    table.integer('objective');
    table.integer('current_counter').defaultTo(0);
    table.date('last_reset');
  }).then(() => {
    return knex.schema.createTable('habit_logs', table => {
      table.increments('id');
      table.integer('task_id').references('id').inTable('tasks').onDelete('CASCADE');
      table.date('date');
      table.integer('counter_value');
      table.integer('objective'); // Adicionar coluna objective
      table.timestamps(true, true);
    });
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
  return knex.schema.dropTable('habit_logs').then(() => {
    return knex.schema.alterTable('tasks', table => {
      table.dropColumn('is_recurring');
      table.dropColumn('recurrence_type');
      table.dropColumn('objective');
      table.dropColumn('current_counter');
      table.dropColumn('last_reset');
    });
  });
};
