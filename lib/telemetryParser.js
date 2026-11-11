const SUPPORTED = new Set([
  'HEARTBEAT', 'GLOBAL_POSITION_INT', 'ATTITUDE', 'SYS_STATUS',
  'GPS_RAW_INT', 'VFR_HUD', 'STATUSTEXT',
]);
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const degrees = (value) => value * 180 / Math.PI;

class TelemetryParser {
  constructor({ staleAfterMs = 5000, now = Date.now } = {}) {
    this.vehicles = new Map();
    this.staleAfterMs = staleAfterMs;
    this.now = now;
  }

  ingest(packet) {
    if (!packet || typeof packet !== 'object' || Array.isArray(packet)
        || !SUPPORTED.has(packet.mavpackettype)
        || !Number.isInteger(packet.src_system) || packet.src_system < 1 || packet.src_system > 255
        || !Number.isInteger(packet.src_component) || packet.src_component < 0 || packet.src_component > 255) {
      return null;
    }
    let group;
    let values;
    const has = (...keys) => keys.every((key) => finite(packet[key]));
    switch (packet.mavpackettype) {
      case 'HEARTBEAT':
        if (!has('base_mode', 'custom_mode', 'type', 'autopilot', 'system_status')
            || packet.autopilot === 8 || packet.type === 6) return null;
        group = 'heartbeat';
        values = {
          armed: Boolean(packet.base_mode & 128), baseMode: packet.base_mode,
          customMode: packet.custom_mode, vehicleType: packet.type,
          autopilot: packet.autopilot, systemStatus: packet.system_status,
        };
        break;
      case 'GLOBAL_POSITION_INT':
        if (!has('lat', 'lon', 'alt', 'relative_alt')
            || Math.abs(packet.lat) > 90e7 || Math.abs(packet.lon) > 180e7) return null;
        group = 'position';
        values = {
          latitude: packet.lat / 1e7, longitude: packet.lon / 1e7,
          altitudeMsl: packet.alt / 1000, relativeAltitude: packet.relative_alt / 1000,
        };
        break;
      case 'ATTITUDE':
        if (!has('roll', 'pitch', 'yaw')) return null;
        group = 'attitude';
        values = {
          roll: degrees(packet.roll), pitch: degrees(packet.pitch),
          heading: ((degrees(packet.yaw) % 360) + 360) % 360,
        };
        break;
      case 'SYS_STATUS':
        if (!has('voltage_battery', 'current_battery', 'battery_remaining')) return null;
        group = 'battery';
        values = {
          voltage: packet.voltage_battery === 65535 ? null : packet.voltage_battery / 1000,
          current: packet.current_battery === -1 ? null : packet.current_battery / 100,
          remaining: packet.battery_remaining === -1 ? null : packet.battery_remaining,
        };
        break;
      case 'GPS_RAW_INT':
        if (!has('fix_type', 'satellites_visible', 'eph', 'epv')) return null;
        group = 'gps';
        values = {
          fixType: packet.fix_type,
          satellites: packet.satellites_visible === 255 ? null : packet.satellites_visible,
          hdop: packet.eph === 65535 ? null : packet.eph / 100,
          vdop: packet.epv === 65535 ? null : packet.epv / 100,
        };
        break;
      case 'VFR_HUD':
        if (!has('airspeed', 'groundspeed', 'climb', 'throttle')) return null;
        group = 'speed';
        values = {
          airspeed: packet.airspeed, groundspeed: packet.groundspeed,
          climb: packet.climb, throttle: packet.throttle,
        };
        break;
      case 'STATUSTEXT':
        if (typeof packet.text !== 'string' || !has('severity')) return null;
        group = 'statusText';
        values = { text: packet.text.replace(/\0+$/, ''), severity: packet.severity };
        break;
    }
    const timestamp = this.now();
    const state = this.vehicles.get(packet.src_system) || { vehicleId: packet.src_system, groups: {} };
    state.groups[group] = { ...values, srcComponent: packet.src_component, updatedAt: timestamp };
    state.updatedAt = timestamp;
    this.vehicles.set(packet.src_system, state);
    return this.snapshot(state.vehicleId);
  }

  snapshot(vehicleId) {
    const state = this.vehicles.get(vehicleId);
    if (!state) return null;
    const now = this.now();
    const groups = Object.fromEntries(Object.entries(state.groups).map(([key, value]) => [
      key, { ...value, stale: now - value.updatedAt >= this.staleAfterMs },
    ]));
    return {
      vehicleId, updatedAt: state.updatedAt,
      stale: now - state.updatedAt >= this.staleAfterMs,
      connected: Boolean(groups.heartbeat && !groups.heartbeat.stale),
      ...groups,
    };
  }

  snapshots() {
    return [...this.vehicles.keys()].map((id) => this.snapshot(id));
  }
}

module.exports = { TelemetryParser };
