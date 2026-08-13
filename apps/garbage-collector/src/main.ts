import { createServer } from 'node:http';

import { loadConfig } from './config.js';
import { writeLog } from './logging.js';

const config = loadConfig('garbage-collector', 3011);

const server = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ service: config.serviceName, status: 'ok' }));
    return;
  }

  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'not_found' }));
});

function stop(signal: NodeJS.Signals): void {
  writeLog('info', 'service_stopping', { service: config.serviceName, signal });
  server.close((error) => {
    if (error) {
      writeLog('error', 'service_stop_failed', {
        error: error.message,
        service: config.serviceName,
      });
      process.exitCode = 1;
      return;
    }

    writeLog('info', 'service_stopped', { service: config.serviceName });
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
