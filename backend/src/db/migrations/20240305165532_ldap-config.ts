import { Knex } from "knex";

import { TableName } from "../schemas";
import { createOnUpdateTrigger, dropOnUpdateTrigger } from "../utils";

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(TableName.LdapConfig))) {
    await knex.schema.createTable(TableName.LdapConfig, (t) => {
      t.uuid("id", { primaryKey: true }).defaultTo(knex.fn.uuid());
      t.uuid("orgId").notNullable().unique();
      t.foreign("orgId").references("id").inTable(TableName.Organization).onDelete("CASCADE");
      t.boolean("isActive").notNullable();
      t.string("url").notNullable();
      t.string("encryptedBindDN");
      t.string("bindDNIV");
      t.string("bindDNTag");
      t.string("encryptedBindPass");
      t.string("bindPassIV");
      t.string("bindPassTag");
      t.string("searchBase").notNullable();
      t.text("encryptedCACert");
      t.string("caCertIV");
      t.string("caCertTag");
      t.timestamps(true, true, true);
    });
  }

  await createOnUpdateTrigger(knex, TableName.LdapConfig);

  if (!(await knex.schema.hasTable(TableName.UserAliases))) {
    await knex.schema.createTable(TableName.UserAliases, (t) => {
      t.uuid("id", { primaryKey: true }).defaultTo(knex.fn.uuid());
      t.uuid("userId").notNullable();
      t.foreign("userId").references("id").inTable(TableName.Users).onDelete("CASCADE");
      t.string("username").notNullable();
      t.string("aliasType").notNullable();
      t.string("externalId").notNullable();
      t.specificType("emails", "text[]");
      t.uuid("orgId").nullable();
      t.foreign("orgId").references("id").inTable(TableName.Organization).onDelete("CASCADE");
      t.timestamps(true, true, true);
    });
  }

  await createOnUpdateTrigger(knex, TableName.UserAliases);

  await knex.schema.alterTable(TableName.Users, (t) => {
    t.string("username").unique().notNullable();
    t.string("email").nullable().alter();
  });

  await knex(TableName.Users).update("username", knex.ref("email"));
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TableName.LdapConfig);
  await knex.schema.dropTableIfExists(TableName.UserAliases);
  await knex.schema.alterTable(TableName.Users, (t) => {
    t.dropColumn("username");
    // t.string("email").notNullable().alter();
  });
  await dropOnUpdateTrigger(knex, TableName.LdapConfig);
}