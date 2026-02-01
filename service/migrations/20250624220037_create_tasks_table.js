export function up(knex) {
  return knex.schema.createTable('tasks', table => {
    table.increments('id').primary();
    table
      .integer('project_id')
      .notNullable()
      .references('id')
      .inTable('projects')
      .onDelete('CASCADE');
    table
      .integer('parent_id')
      .nullable()
      .references('id')
      .inTable('tasks')
      .onDelete('CASCADE');
    table.string('title').notNullable();
    table.boolean('completed').defaultTo(false);
    table.integer('position').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').nullable();
  });
}

export function down(knex) {
  return knex.schema.dropTableIfExists('tasks');
}
