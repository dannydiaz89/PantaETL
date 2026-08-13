import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { connectionSecrets } from "../src/schema/secrets.js";
import { users } from "../src/schema/users.js";

describe("encrypted connection secrets schema", () => {
  it("persists only encrypted secret material and external key metadata", () => {
    expect(connectionSecrets.encryptedValue.getSQLType()).toBe("text");
    expect(connectionSecrets.encryptionNonce.getSQLType()).toBe("text");
    expect(connectionSecrets.encryptionKeyReference.getSQLType()).toBe("text");
    expect(connectionSecrets.encryptionAlgorithm.getSQLType()).toBe("text");
    expect(Object.keys(connectionSecrets)).not.toContain("plaintext");
    expect(Object.keys(connectionSecrets)).not.toContain("value");
  });

  it("keeps secret bindings owner-scoped and blocks owner deletion", () => {
    const configuration = getTableConfig(connectionSecrets);
    const ownerForeignKey = configuration.foreignKeys.find(
      (foreignKey) => foreignKey.getName() === "connection_secrets_owner_user_id_users_id_fk",
    );

    expect(ownerForeignKey?.reference().foreignTable).toBe(users);
    expect(ownerForeignKey?.onDelete).toBe("restrict");
    expect(configuration.uniqueConstraints).toHaveLength(1);
  });
});
