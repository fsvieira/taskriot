/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function up(knex) {
  return knex.schema.createTable('task_labels', table => {
    table.increments('id');
    table.integer('task_id').unsigned().notNullable().references('id').inTable('tasks').onDelete('CASCADE');
    table.integer('label_id').unsigned().notNullable().references('id').inTable('labels').onDelete('CASCADE');
    table.timestamps(true, true);
    table.unique(['task_id', 'label_id']);

    table.index('task_id');
    table.index('label_id');
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export function down(knex) {
  return knex.schema.dropTable('task_labels');
}