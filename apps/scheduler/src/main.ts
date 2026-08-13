import { createServer } from 'node:http';

import { createDatabaseConnection } from '@pantaetl/database';

import { loadConfig } from './config.js';
import { createInternalPipelineRunRouteHandler } from './internal-run-route.js';
import { writeLog } from './logging.js';
import { enqueuePipelineRunForOwner } from './pipeline-actions.js';
import { SchedulerRuntime } from './runtime.js';

const config = loadConfig('scheduler', 3010);
const database = createDatabaseConnection(config.databaseUrl);
const runtime = new SchedulerRuntime(database);
const internalPipelineRunHandler = createInternalPipelineRunRouteHandler({
  database: database.db,
  enqueuePipelineRunForOwner,
  internalToken: config.internalToken,
});

const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    const health = await runtime.getHealth();
    response.writeHead(health.status === 'ok' ? 200 : 503, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ service: config.serviceName, ...health }));
    return;
  }

  if (request.url === '/internal/pipeline-runs') {
    const internalResponse = await internalPipelineRunHandler(await toWebRequest(request));
    response.writeHead(internalResponse.status, Object.fromEntries(internalResponse.headers.entries()));
    response.end(await internalResponse.text());
    return;
  }

  response.writeHead(404, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ error: 'not_found' }));
});

/** Read the incoming request body once before adapting Node's HTTP request to a Web Request. */
async function readRequestBody(request: import("node:http").IncomingMessage): Promise<string> {
  let body = "";
  for await (const chunk of request) {
    body += typeof chunk === "string" ? chunk : chunk.toString("utf8");
  }

  return body;
}

/** Adapt a Node request to a Web Request without assigning a body to GET or HEAD. */
async function toWebRequest(request: import("node:http").IncomingMessage): Promise<Request> {
  const method = request.method ?? "GET";
  const init: RequestInit = { headers: requestHeaders(request), method };
  if (method !== "GET" && method !== "HEAD") {
    init.body = await readRequestBody(request);
  }

  return new Request("http://scheduler/internal/pipeline-runs", init);
}

/** Convert Node's multi-value request headers to the standard Web Request representation. */
function requestHeaders(request: import("node:http").IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }

  return headers;
}

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
