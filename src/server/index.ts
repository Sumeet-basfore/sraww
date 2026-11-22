import { createApp } from './app.ts';
import { loadConfig } from './config.ts';

const config = loadConfig();
const app = createApp(config);

// Bind to loopback only; nothing on the network can reach this server.
const server = app.listen(config.PORT, '127.0.0.1', () => {
  console.log(`sraww server listening on http://127.0.0.1:${config.PORT}`);
});

function shutdown(): void {
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
