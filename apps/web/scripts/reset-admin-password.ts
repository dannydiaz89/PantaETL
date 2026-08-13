import { createDatabaseConnection } from "@pantaetl/database";

import { resetAdminPassword } from "../src/auth/admin.js";
import { loadAuthConfig } from "../src/auth/config.js";

const email = process.env.PANTAETL_ADMIN_EMAIL;
if (email === undefined) {
  throw new Error("PANTAETL_ADMIN_EMAIL is required for an explicit administrator password reset.");
}
const connection = createDatabaseConnection(loadAuthConfig().databaseUrl);
try {
  const temporaryPassword = await resetAdminPassword(connection.db, email);
  if (temporaryPassword === undefined) {
    process.stdout.write("No matching administrator was found. No account was changed.\n");
  } else {
    process.stdout.write(`Administrator password reset. Temporary password: ${temporaryPassword}\n`);
  }
} finally {
  await connection.close();
}
