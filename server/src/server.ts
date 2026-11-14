import { app } from './app';
import { config } from './shared/config';

const server = app.listen(config.port, () => {
  console.log(`[Appointly API] Server listening on port ${config.port} in ${config.nodeEnv} mode`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('[Appointly API] SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('[Appointly API] Process terminated.');
    process.exit(0);
  });
});

export { server };

