/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
  return knex.schema.createTable('label_schedules', table => {
    table.increments('id');
    table.integer('label_id').unsigned().notNullable().references('id').inTable('labels').onDelete('CASCADE');
    table.integer('day_of_week').notNullable(); // 0=Sunday, 6=Saturday
    table.time('start_time').notNullable();
    table.time('end_time').notNullable();
    table.timestamps(true, true);

    table.index('label_id');
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
  return knex.schema.dropTable('label_schedules');
}