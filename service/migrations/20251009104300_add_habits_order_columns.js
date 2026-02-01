/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // Independent ordering for Habits view (does not affect task tree)
  await knex.schema.alterTable('projects', (table) => {
    table.integer('habits_order').defaultTo(0).index();
  });

  await knex.schema.alterTable('tasks', (table) => {
    // Only used for is_recurring = true tasks in Habits page
    table.integer('habits_order').defaultTo(0).index();
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.alterTable('tasks', (table) => {
    table.dropColumn('habits_order');
  });

  await knex.schema.alterTable('projects', (table) => {
    table.dropColumn('habits_order');
  });
}