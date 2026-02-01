export async function up(knex) {
  await knex.schema.createTable('project_emotional_indicators', (table) => {
    table.increments('id').primary();
    table.integer('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    table.integer('indicator').notNullable(); // 1, 2, or 3 for the three questions
    table.integer('value').notNullable(); // 1 (Não), 2 (Sim), 3 (Muito)
    table.timestamps(true, true);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('project_emotional_indicators');
}