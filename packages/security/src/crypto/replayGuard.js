/**
 * Replay Attack Defense & Monotonic Window Guard.
 * 
 * Protects communication conduits against packet capture and re-transmission attacks.
 * Features:
 * - Clock drift validation against system epoch time (rejects drifted timestamps)
 * - Monotonic sequence checking with sliding bitmap window for out-of-order networks
 * - Independent tracking per peer device ID
 */

const { CRYPTO_CONSTANTS } = require('./constants');

class ReplayGuard {
  /**
   * @param {Object} [options]
   * @param {number} [options.maxDriftMs] - Maximum allowed timestamp drift
   * @param {number} [options.windowCapacity] - Sliding window capacity
   */
  constructor(options = {}) {
    this.maxDriftMs = options.maxDriftMs || CRYPTO_CONSTANTS.MAX_TIMESTAMP_DRIFT_MS;
    this.windowCapacity = options.windowCapacity || CRYPTO_CONSTANTS.REPLAY_WINDOW_CAPACITY;
    // Map of deviceId -> { highestPacketId: number, seenIds: Set<number> }
    this.deviceStates = new Map();
  }

  /**
   * Validates an incoming packet timestamp and monotonic sequence ID.
   * 
   * @param {string} deviceId - Remote peer device identifier
   * @param {number} packetId - Monotonically increasing sequence number
   * @param {number} timestamp - Unix epoch milliseconds when the packet was created
   * @param {number} [nowMs] - Current time override for deterministic testing
   * @returns {{ valid: boolean, reason?: string }}
   */
  checkAndRecord(deviceId, packetId, timestamp, nowMs = Date.now()) {
    if (typeof packetId !== 'number' || packetId < 0 || !Number.isFinite(packetId)) {
      return { valid: false, reason: 'INVALID_PACKET_ID' };
    }

    if (typeof timestamp !== 'number' || timestamp <= 0 || !Number.isFinite(timestamp)) {
      return { valid: false, reason: 'INVALID_TIMESTAMP' };
    }

    // 1. Clock drift check
    const drift = Math.abs(nowMs - timestamp);
    if (drift > this.maxDriftMs) {
      return {
        valid: false,
        reason: 'TIMESTAMP_EXPIRED',
        driftMs: drift,
      };
    }

    // 2. Sequence replay check
    let state = this.deviceStates.get(deviceId);
    if (!state) {
      state = {
        highestPacketId: packetId,
        seenIds: new Set([packetId]),
      };
      this.deviceStates.set(deviceId, state);
      return { valid: true };
    }

    // Duplicate check
    if (state.seenIds.has(packetId)) {
      return {
        valid: false,
        reason: 'DUPLICATE_PACKET_ID',
        packetId,
      };
    }

    // In-order advancement
    if (packetId > state.highestPacketId) {
      state.highestPacketId = packetId;
      state.seenIds.add(packetId);

      // Prune window if exceeds capacity
      if (state.seenIds.size > this.windowCapacity) {
        const threshold = state.highestPacketId - this.windowCapacity;
        for (const id of state.seenIds) {
          if (id < threshold) {
            state.seenIds.delete(id);
          }
        }
      }

      return { valid: true };
    }

    // Out-of-order check (packetId < highestPacketId)
    const distance = state.highestPacketId - packetId;
    if (distance >= this.windowCapacity) {
      return {
        valid: false,
        reason: 'PACKET_BEHIND_WINDOW',
        packetId,
        highestPacketId: state.highestPacketId,
      };
    }

    // Valid out-of-order within sliding window
    state.seenIds.add(packetId);
    return { valid: true };
  }

  /**
   * Resets replay state for a specific device (e.g. on clean re-pair).
   * @param {string} deviceId
   */
  resetDevice(deviceId) {
    this.deviceStates.delete(deviceId);
  }

  /**
   * Clears all device tracking state.
   */
  clear() {
    this.deviceStates.clear();
  }
}

module.exports = { ReplayGuard };
