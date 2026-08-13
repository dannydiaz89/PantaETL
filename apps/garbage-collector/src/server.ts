import { createServer, type Server, type ServerResponse } from 'node:http';

import type { ServiceConfig } from './config.js';

/** Dependencies required to report garbage-collector readiness. */
export interface GarbageCollectorServerDependencies {
  /** Confirms that the service can use its retention database connection. */
  checkDatabase(): Promise<void>;
}

/** Creates the HTTP health boundary for the garbage-collector service. */
export function createGarbageCollectorServer(
  config: ServiceConfig,
  dependencies: GarbageCollectorServerDependencies,
): Server {
  return createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      void respondToHealthCheck(response, config.serviceName, dependencies.checkDatabase);
      return;
    }

    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'not_found' }));
  });
}

/** Reports readiness only after the configured PostgreSQL connection responds. */
async function respondToHealthCheck(
  response: ServerResponse,
  serviceName: string,
  checkDatabase: () => Promise<void>,
): Promise<void> {
  try {
    await checkDatabase();
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ service: serviceName, status: 'ok' }));
  } catch {
    response.writeHead(503, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ service: serviceName, status: 'unavailable' }));
  }
}
