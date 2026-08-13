import { createServer } from 'node:http';

import { createDatabaseConnection } from '@pantaetl/database';

import { loadConfig } from './config.js';
import { writeLog } from './logging.js';
import { SchedulerRuntime } from './runtime.js';

const config = loadConfig('scheduler', 3010);
const runtime = new SchedulerRuntime(createDatabaseConnection(config.databaseUrl));

const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    const health = await runtime.getHealth();
    response.writeHead(health.status === 'ok' ? 200 : 503, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ service: config.serviceName, ...health }));
    return;
  }

  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'not_found' }));
});

async function stop(signal: NodeJS.Signals): Promise<void> {
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

    await runtime.stop();
    writeLog('info', 'service_stopped', { service: config.serviceName });
  });
}

process.once('SIGINT', () => void stop('SIGINT'));
process.once('SIGTERM', () => void stop('SIGTERM'));

server.listen(config.port, config.host, () => {
  writeLog('info', 'service_started', {
    host: config.host,
    port: config.port,
    service: config.serviceName,
  });
});
