/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
  return knex.schema.alterTable('habit_logs', table => {
    table.datetime('date').alter(); // Change from DATE to DATETIME
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
  return knex.schema.alterTable('habit_logs', table => {
    table.date('date').alter(); // Revert back to DATE
  });
}
