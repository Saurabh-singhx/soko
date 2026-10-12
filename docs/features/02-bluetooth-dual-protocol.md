# Feature Research & Engineering: Bluetooth Dual-Protocol Architecture

> **Feature Goal**: Maintain a zero-drain persistent link between mobile and desktop using Bluetooth Low Energy (BLE), with a fallback to Bluetooth Classic (RFCOMM/SPP) for non-Wi-Fi environments.

---

## 1. Technical Requirements

1. **Persistent Zero-Drain Link**: The mobile phone and desktop must remain connected whenever they are within proximity (~10 meters) without draining phone battery.
2. **Instant Event Delivery**: Notifications, CLI commands, and heartbeat pings must arrive with sub-100ms latency.
3. **Cross-Platform Bluetooth Abstraction**:
   - **Linux Desktop**: Direct communication with `BlueZ` over D-Bus via the Rust `bluer` crate.
   - **Windows Desktop**: Direct communication with WinRT `Windows.Devices.Bluetooth` API via the Rust `windows` crate.
   - **Android Mobile**: Native BLE Central/Peripheral modes + RFCOMM BluetoothSocket via Flutter platform channels.

---

## 2. Research & Exploration History

### Attempt 1: Raw BLE GATT Chunks for All Transfers (Failed & Abandoned)
- **Concept**: Use BLE GATT Characteristics for everything, including sending 40MB build APKs by splitting them into 512-byte MTU chunks.
- **Why it Failed**:
  - **Throughput Bottleneck**: Even with MTU size negotiated to 517 bytes and a connection interval of 15ms, the theoretical maximum BLE throughput is ~80 KB/s. Real-world speeds on Android hovered at **~18 KB/s**.
  - Transferring a 45MB APK took **over 41 minutes**, during which Bluetooth controller buffers on the desktop choked, dropping packets and stalling the connection.
  - Bluetooth controllers on consumer laptops would occasionally reset or hang completely under continuous high-duty BLE streaming.

### Attempt 2: Classic Bluetooth RFCOMM Only (Failed as Primary)
- **Concept**: Rely solely on Bluetooth Classic Serial Port Profile (RFCOMM/SPP).
- **Why it Failed**:
  - Classic Bluetooth requires keeping the radio active in high-power state continuously. Battery consumption on the phone spiked by 12–18% over an 8-hour workday.
  - Windows requires pairing RFCOMM as a legacy COM port or pairing device in Windows Settings before the socket can open, ruining the seamless plug-and-play experience.

### Attempt 3: Dual-Mode Asymmetric Strategy (Selected Architecture)
- **Architecture**:
  1. **Primary Control Channel (BLE)**:
     - Handles 98% of all interactions: Heartbeats, presence detection, notification mirroring, CLI command execution triggers, and mascot state updates.
     - Uses custom GATT Service with two characteristics: `TX_DATA` (Write Without Response) and `RX_DATA` (Notify).
  2. **Bulk Data Channel**:
     - Automatically routes to **Local Hotspot / LAN HTTP Socket** (30–60 MB/s).
     - If neither device is on Wi-Fi/Hotspot, falls back to **Bluetooth Classic RFCOMM** (~180 KB/s), strictly reserving it for offline emergency transfers.

---

## 3. BLE GATT Specification

### Custom Service UUIDs
```
SOKO_SERVICE_UUID:        7d2a0001-f28a-4d2b-98f1-c30953a81200
SOKO_CHAR_COMMAND_TX:     7d2a0002-f28a-4d2b-98f1-c30953a81200 (Write Without Response)
SOKO_CHAR_EVENT_RX:       7d2a0003-f28a-4d2b-98f1-c30953a81200 (Notify)
SOKO_CHAR_AUTH_PIN:       7d2a0004-f28a-4d2b-98f1-c30953a81200 (Read / Write Encrypted)
```

### Packet Framing Protocol
Because MTU limits vary (standard default: 23 bytes, negotiated: up to 517 bytes), all packets transmitted across BLE adhere to a compact binary framing header:

```
┌──────────────┬──────────────┬──────────────┬──────────────┬────────────────────────┐
│ Magic (2B)   │ Version (1B) │ PacketType   │ Length (2B)  │ Encrypted Payload (NB) │
│ 0x53 0x4B    │ 0x01         │ (1B)         │ Big-Endian   │ AES-256-GCM Envelope   │
└──────────────┴──────────────┴──────────────┴──────────────┴────────────────────────┘
```

- **Magic Bytes**: `0x53 0x4B` ("SK" for Soko).
- **Packet Types**:
  - `0x01`: Heartbeat Ping / Pong.
  - `0x02`: Notification Mirror.
  - `0x03`: Remote CLI Trigger.
  - `0x04`: CLI Stdout Chunk.
  - `0x05`: File Offer / Hotspot Handoff.
  - `0x06`: Auth / PIN Verification.

---

## 4. MTU Size Negotiation & Connection Lifecycles

1. **Connection Initiation**: Mobile advertises as `Soko-Device-[ID]`; Desktop daemon scans and connects upon detecting authorized device ID.
2. **MTU Exchange**: Upon connection, Desktop requests `MTU = 517` (maximum BLE 5.0 MTU).
   - If granted: Packets up to 512 bytes are sent un-fragmented.
   - If rejected (older controllers defaulting to 23 bytes): The fragmentation manager chunks payloads into 20-byte slices with 2-byte chunk sequence headers.
3. **Heartbeat & Dead Peer Detection**:
   - Mobile sends a 4-byte ping every 10 seconds.
   - If Desktop receives no ping for 30 seconds, connection drops to `DISCONNECTED` state, and the Dynamic Island mascot switches to the "searching" state.
   - Auto-reconnect resumes in background scanning mode with exponential backoff (1s, 2s, 4s, capped at 10s).
