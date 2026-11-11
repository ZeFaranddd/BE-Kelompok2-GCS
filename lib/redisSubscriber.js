const { createClient } = require('redis');

function createRedisSubscriber({ url, channel, onPacket, onStatus, logger = console }) {
  const client = createClient({
    url,
    socket: { connectTimeout: 3000, reconnectStrategy: (retries) => Math.min(250 * (retries + 1), 5000) },
  });
  let lastStatus = null;
  const status = (connected) => {
    if (lastStatus !== connected) {
      lastStatus = connected;
      onStatus(connected);
    }
  };
  client.on('error', (error) => {
    status(false);
    logger.warn(`Redis subscriber: ${error.message}`);
  });
  client.on('reconnecting', () => status(false));
  client.on('ready', () => status(true));
  client.on('end', () => status(false));

  return {
    async start() {
      await client.connect();
      await client.subscribe(channel, (message) => {
        let packet;
        try {
          packet = JSON.parse(message);
        } catch {
          logger.warn(`Redis ${channel}: abaikan JSON tidak valid`);
          return;
        }
        onPacket(packet);
      });
    },
    stop() {
      if (client.isOpen) client.disconnect();
      status(false);
    },
  };
}

module.exports = { createRedisSubscriber };
