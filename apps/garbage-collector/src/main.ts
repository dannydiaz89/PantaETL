import { createDatabaseConnection } from '@pantaetl/database';

import { loadConfig } from './config.js';
import { writeLog } from './logging.js';
import { createGarbageCollectorServer } from './server.js';

const config = loadConfig('garbage-collector', 3011);
const database = createDatabaseConnection(config.databaseUrl);

const server = createGarbageCollectorServer(config, {
  checkDatabase: async () => {
    await database.sql`select 1`;
  },
});

function stop(signal: NodeJS.Signals): void {
  writeLog('info', 'service_stopping', { service: config.serviceName, signal });
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
});
