import { createDatabaseConnection } from "@pantaetl/database";

import { createFirstAdmin, parseAdminIdentity } from "../src/auth/admin.js";
import { loadAuthConfig } from "../src/auth/config.js";

const identity = parseAdminIdentity({
  email: process.env.PANTAETL_ADMIN_EMAIL,
  username: process.env.PANTAETL_ADMIN_USERNAME,
});
const connection = createDatabaseConnection(loadAuthConfig().databaseUrl);
try {
  const result = await createFirstAdmin(connection.db, identity);
  if (result.created && result.temporaryPassword !== undefined) {
    process.stdout.write(`Initial administrator created for ${identity.email}. Temporary password: ${result.temporaryPassword}\n`);
  } else {
    process.stdout.write("An initial administrator already exists. No account was changed.\n");
  }
} finally {
  await connection.close();
}
