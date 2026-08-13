import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { users } from "./users.js";

/**
 * Encrypted connection credentials referenced by pipeline component bindings.
 *
 * Encryption and decryption occur outside PostgreSQL. This table deliberately
 * stores only ciphertext, its nonce, and a reference to externally supplied
 * key material; it does not model decrypted values.
 */
export const connectionSecrets = pgTable(
  "connection_secrets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    binding: text("binding").notNull(),
    encryptedValue: text("encrypted_value").notNull(),
    encryptionNonce: text("encryption_nonce").notNull(),
    encryptionKeyReference: text("encryption_key_reference").notNull(),
    encryptionAlgorithm: text("encryption_algorithm").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("connection_secrets_owner_user_id_index").on(table.ownerUserId),
    unique("connection_secrets_owner_user_id_binding_unique").on(table.ownerUserId, table.binding),
  ],
);

/** Database record shape containing encrypted, never plaintext, secret data. */
export type EncryptedConnectionSecret = typeof connectionSecrets.$inferSelect;

/** Input required to persist encrypted secret data after encryption has completed. */
export type NewEncryptedConnectionSecret = typeof connectionSecrets.$inferInsert;
