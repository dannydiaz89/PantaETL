import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ServiceConfig } from '../src/config.js';
import { createGarbageCollectorServer } from '../src/server.js';

const config: ServiceConfig = {
  cleanupBatchSize: 100,
  cleanupIntervalMilliseconds: 60_000,
  databaseUrl: 'postgresql://pantaetl:password@localhost:5432/pantaetl',
  host: '127.0.0.1',
  port: 3011,
  serviceName: 'garbage-collector',
  storageRoot: '/var/lib/pantaetl/storage',
};

const servers: ReturnType<typeof createGarbageCollectorServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  })));
});

describe('garbage-collector health endpoint', () => {
  it('reports ready after confirming database access', async () => {
    const checkDatabase = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    const response = await requestHealth(checkDatabase);

    expect(checkDatabase).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ service: 'garbage-collector', status: 'ok' });
  });

  it('reports unavailable without exposing a database error', async () => {
    const response = await requestHealth(async () => {
      throw new Error('connection password rejected');
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ service: 'garbage-collector', status: 'unavailable' });
  });
});

/** Starts an isolated service instance and returns its health response. */
async function requestHealth(checkDatabase: () => Promise<void>): Promise<Response> {
  const server = createGarbageCollectorServer(config, { checkDatabase });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, config.host, resolve));
  const address = server.address() as AddressInfo;

  return fetch(`http://${config.host}:${address.port}/health`);
}
