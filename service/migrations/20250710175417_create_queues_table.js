export async function up(knex) {
  await knex.schema.createTable("queues", (table) => {
    table.increments("id").primary(); // INTEGER AUTOINCREMENT
    table.string("name").notNullable().unique(); // nome único
    table.text("project_ids").notNullable().defaultTo("[]"); // JSON.stringify([])
    table.timestamp("created_at").notNullable();
    table.timestamp("updated_at").notNullable();
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("queues");
}
