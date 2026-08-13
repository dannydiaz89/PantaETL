import { createDatabaseConnection } from '@pantaetl/database';

import {
  ExecutionRetentionCleanup,
  RetentionCleanup,
  createRetentionRepository,
} from './cleanup.js';
import { loadConfig } from './config.js';
import { writeLog } from './logging.js';
import { GarbageCollectorRuntime } from './runtime.js';
import { createGarbageCollectorServer } from './server.js';
import { LocalRetentionStorage } from './storage.js';

const config = loadConfig('garbage-collector', 3011);
const database = createDatabaseConnection(config.databaseUrl);
const repository = createRetentionRepository(database.db);
const storageCleanup = new RetentionCleanup(
  repository,
  new LocalRetentionStorage(config.storageRoot),
  config.cleanupBatchSize,
);
const executionCleanup = new ExecutionRetentionCleanup(repository, config.cleanupBatchSize);
const runtime = new GarbageCollectorRuntime({
  run: async () => {
    await storageCleanup.run();
    await executionCleanup.run();
  },
}, config.cleanupIntervalMilliseconds, () => {
  writeLog('error', 'retention_cleanup_failed', { service: config.serviceName });
});

const server = createGarbageCollectorServer(config, {
  checkDatabase: async () => {
    await database.sql`select 1`;
  },
});

function stop(signal: NodeJS.Signals): void {
  writeLog('info', 'service_stopping', { service: config.serviceName, signal });
  runtime.stop();
  server.close(async (error) => {
    if (error) {
      writeLog('error', 'service_stop_failed', {
        error: error.message,
        service: config.serviceName,
      });
      process.exitCode = 1;
      return;
    }

    try {
      await database.close();
      writeLog('info', 'service_stopped', { service: config.serviceName });
    } catch (closeError) {
      writeLog('error', 'service_stop_failed', {
        error: closeError instanceof Error ? closeError.message : 'unknown',
        service: config.serviceName,
      });
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));

server.listen(config.port, config.host, () => {
  writeLog('info', 'service_started', {
    host: config.host,
    port: config.port,
    service: config.serviceName,
  });
  runtime.start();
});
