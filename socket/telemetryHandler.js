const { TelemetryParser } = require('../lib/telemetryParser');

function createTelemetryHandler(io, { staleAfterMs = 5000 } = {}) {
  const parser = new TelemetryParser({ staleAfterMs });
  const dirty = new Set();
  let redisConnected = false;
  const status = () => ({ redisConnected });
  const onConnection = (socket) => {
    socket.emit('telemetry:status', status());
    socket.emit('telemetry:snapshot', parser.snapshots());
  };
  io.on('connection', onConnection);

  // Batasi update UI menjadi 10 Hz; data parsial tetap digabung setiap pesan.
  const lastHealth = new Map();
  const timer = setInterval(() => {
    for (const state of parser.snapshots()) {
      const health = JSON.stringify([
        state.connected, state.stale,
        ...Object.values(state).filter((value) => value && typeof value === 'object').map((value) => value.stale),
      ]);
      if (dirty.has(state.vehicleId) || lastHealth.get(state.vehicleId) !== health) {
        io.emit('telemetry:update', state);
        lastHealth.set(state.vehicleId, health);
      }
    }
    dirty.clear();
  }, 100);
  timer.unref();

  return {
    onPacket(packet) {
      const state = parser.ingest(packet);
      if (state) dirty.add(state.vehicleId);
    },
    onStatus(connected) {
      redisConnected = connected;
      io.emit('telemetry:status', status());
    },
    stop() {
      clearInterval(timer);
      io.off('connection', onConnection);
    },
  };
}

module.exports = { createTelemetryHandler };
