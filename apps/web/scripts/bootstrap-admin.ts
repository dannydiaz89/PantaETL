import { createDatabaseConnection } from "@pantaetl/database";

import { ensureFirstAdmin, parseAdminIdentity } from "../src/auth/admin.js";
import { loadAuthConfig } from "../src/auth/config.js";

const identity = parseAdminIdentity({
  email: process.env.PANTAETL_ADMIN_EMAIL,
  username: process.env.PANTAETL_ADMIN_USERNAME,
});
const connection = createDatabaseConnection(loadAuthConfig().databaseUrl);
try {
  const result = await ensureFirstAdmin(connection.db, identity);
  if (result.created && result.temporaryPassword !== undefined) {
    process.stdout.write(
      `Initial administrator created for ${identity.email} with the password ${result.temporaryPassword}. `
      + "Signing in with it leads straight to a screen that replaces both, and the deployment stays restricted until that is done.\n",
    );
  } else {
    process.stdout.write("This deployment already has accounts. No account was changed.\n");
  }
} finally {
  await connection.close();
}
