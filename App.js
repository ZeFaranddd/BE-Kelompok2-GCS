require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { createRedisSubscriber } = require('./lib/redisSubscriber');
const { createTelemetryHandler } = require('./socket/telemetryHandler');

function createApplication({ missionsRoute = require('./routes/missions') } = {}) {
  const app = express();
  const origin = process.env.CORS_ORIGIN || '*';
  app.use(cors({ origin }));
  app.use(express.json());
  app.use('/missions', missionsRoute);

  const server = createServer(app);
  const io = new Server(server, { cors: { origin } });
  const staleAfterMs = Number(process.env.TELEMETRY_STALE_MS || 5000);
  if (!Number.isFinite(staleAfterMs) || staleAfterMs <= 0) {
    throw new Error('TELEMETRY_STALE_MS harus berupa angka positif');
  }
  const telemetry = createTelemetryHandler(io, { staleAfterMs });
  const subscriber = createRedisSubscriber({
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379/0',
    channel: process.env.TELEMETRY_CHANNEL || 'plane_state',
    onPacket: telemetry.onPacket,
    onStatus: telemetry.onStatus,
  });
  return {
    app, server, io,
    startTelemetry() {
      // Reconnect Redis berjalan di background; API mission tetap tersedia.
      subscriber.start().catch((error) => console.error(`Telemetry subscriber: ${error.message}`));
    },
    async stop() {
      subscriber.stop();
      telemetry.stop();
      await new Promise((resolve) => io.close(resolve));
    },
  };
}

if (require.main === module) {
  const application = createApplication();
  const port = Number(process.env.PORT || 3000);
  application.server.listen(port, () => console.log(`Server running on http://localhost:${port}`));
  application.startTelemetry();
  const stop = () => application.stop().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}

module.exports = { createApplication };
