import { CLIENT_BUILD_DIR, createApp } from './app.ts';
import { createAiServices } from './ai/services.ts';
import { loadConfig } from './config.ts';
import { createDiagramStore } from './storage/diagram-store.ts';

const config = loadConfig();
// Built here, not inside createApp, so shutdown can stop the CLI processes they own.
const ai = createAiServices(config);
const app = createApp(config, createDiagramStore(config.DIAGRAMS_DIR), CLIENT_BUILD_DIR, ai);

// Bind to loopback only; nothing on the network can reach this server.
const server = app.listen(config.PORT, '127.0.0.1', () => {
  console.log(`sraww server listening on http://127.0.0.1:${config.PORT}`);
});

function shutdown(): void {
  ai.close();
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
