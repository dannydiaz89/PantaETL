import { createFileRoute } from "@tanstack/react-router";

import { createStagedUpload } from "@pantaetl/database";

import { getApiSession } from "../../auth/api-session.js";
import { controlPlaneDatabase } from "../../auth/server.js";
import { createSourceUploadRouteHandlers } from "../../uploads/collection-route.js";
import { LocalImportStorage, resolveStorageRoot } from "../../uploads/import-storage.js";

/** Stages a file in internal storage so a file-backed Source can read it. */
export const Route = createFileRoute("/api/uploads")({
  server: {
    handlers: createSourceUploadRouteHandlers({
      createStagedUpload,
      database: controlPlaneDatabase,
      getSession: (request) => getApiSession(request.headers),
      onStorageFailure: (error) => {
        // The response deliberately withholds the cause, so the operator needs it here.
        console.log(JSON.stringify({
          level: "error",
          message: "Internal storage rejected an upload.",
          reason: error instanceof Error ? error.message : "unknown",
          storageRoot: resolveStorageRoot(),
        }));
      },
      storage: new LocalImportStorage(resolveStorageRoot()),
    }),
  },
});
