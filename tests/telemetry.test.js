const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { TelemetryParser } = require('../lib/telemetryParser');
const { createTelemetryHandler } = require('../socket/telemetryHandler');

const packet = (type, fields = {}, system = 1) => ({
  mavpackettype: type, src_system: system, src_component: 1, ...fields,
});
const heartbeat = (system = 1) => packet('HEARTBEAT', {
  base_mode: 128, custom_mode: 3, type: 2, autopilot: 3, system_status: 4,
}, system);
const position = (system = 1) => packet('GLOBAL_POSITION_INT', {
  lat: -77700000, lon: 1103700000, relative_alt: 12500, alt: 150000,
}, system);

test('converts position units, merges heartbeat, and keeps vehicles separate', () => {
  const parser = new TelemetryParser();
  parser.ingest(heartbeat());
  const state = parser.ingest(position());
  assert.equal(state.position.latitude, -7.77);
  assert.equal(state.position.longitude, 110.37);
  assert.equal(state.position.relativeAltitude, 12.5);
  assert.equal(state.position.altitudeMsl, 150);
  assert.equal(state.heartbeat.armed, true);
  assert.equal(state.connected, true);
  parser.ingest(heartbeat(2));
  assert.equal(parser.snapshots().length, 2);
  assert.equal(parser.snapshot(2).position, undefined);
});

test('converts angles and normalizes negative heading', () => {
  const parser = new TelemetryParser();
  const { attitude } = parser.ingest(packet('ATTITUDE', { roll: Math.PI / 2, pitch: 0, yaw: -Math.PI / 2 }));
  assert.equal(attitude.roll, 90);
  assert.equal(attitude.pitch, 0);
  assert.equal(attitude.heading, 270);
});

test('battery and GPS unknown sentinels become null', () => {
  const parser = new TelemetryParser();
  let state = parser.ingest(packet('SYS_STATUS', {
    voltage_battery: 12000, current_battery: 250, battery_remaining: 80,
  }));
  assert.equal(state.battery.voltage, 12);
  assert.equal(state.battery.current, 2.5);
  state = parser.ingest(packet('SYS_STATUS', {
    voltage_battery: 65535, current_battery: -1, battery_remaining: -1,
  }));
  assert.equal(state.battery.voltage, null);
  assert.equal(state.battery.current, null);
  assert.equal(state.battery.remaining, null);
  state = parser.ingest(packet('GPS_RAW_INT', { fix_type: 0, satellites_visible: 255, eph: 65535, epv: 65535 }));
  assert.equal(state.gps.satellites, null);
  assert.equal(state.gps.hdop, null);
});

test('fresh position does not hide an expired heartbeat or attitude', () => {
  let now = 1000;
  const parser = new TelemetryParser({ now: () => now, staleAfterMs: 5000 });
  parser.ingest(heartbeat());
  parser.ingest(packet('ATTITUDE', { roll: 0, pitch: 0, yaw: 0 }));
  now = 6000;
  const state = parser.ingest(position());
  assert.equal(state.stale, false);
  assert.equal(state.position.stale, false);
  assert.equal(state.connected, false);
  assert.equal(state.attitude.stale, true);
  now = 11000;
  assert.equal(parser.snapshot(1).stale, true);
});

test('ignores invalid data, unsupported messages and peripheral heartbeats', () => {
  const parser = new TelemetryParser();
  for (const input of [null, [], 42, {}, packet('OTHER'),
    { ...heartbeat(), src_system: 0 },
    { ...heartbeat(), autopilot: 8 },
    packet('ATTITUDE', { roll: NaN, pitch: 0, yaw: 0 }),
    packet('GLOBAL_POSITION_INT', { lat: 91e7, lon: 0, alt: 0, relative_alt: 0 }),
  ]) assert.equal(parser.ingest(input), null);
  assert.deepEqual(parser.snapshots(), []);
});

test('snapshots are detached from internal state', () => {
  const parser = new TelemetryParser();
  const state = parser.ingest(heartbeat());
  state.heartbeat.armed = false;
  assert.equal(parser.snapshot(1).heartbeat.armed, true);
});

test('Socket.IO sends initial snapshot, updates, and stale transition without new packets', async () => {
  const io = new EventEmitter();
  const handler = createTelemetryHandler(io, { staleAfterMs: 500 });
  try {
    handler.onPacket(heartbeat());
    const sent = [];
    io.emit('connection', { emit: (event, data) => sent.push({ event, data }) });
    assert.equal(sent[0].event, 'telemetry:status');
    assert.equal(sent[1].event, 'telemetry:snapshot');
    assert.equal(sent[1].data[0].connected, true);
    const updates = [];
    io.on('telemetry:update', (state) => updates.push(state));
    await new Promise((resolve) => setTimeout(resolve, 750));
    assert.ok(updates.some((state) => state.connected));
    assert.ok(updates.some((state) => !state.connected && state.stale));
  } finally {
    handler.stop();
  }
});
