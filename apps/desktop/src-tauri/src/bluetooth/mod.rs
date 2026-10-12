//! Bluetooth connectivity subsystem.
//!
//! Exposes BLE GATT communication, packet framing, and Classic RFCOMM fallback.

pub mod ble;
pub mod protocol;

pub use ble::{BleConnectionState, BleService};
pub use protocol::{PacketType, SokoEnvelope};
