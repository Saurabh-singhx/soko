//! Protocol packet definitions and binary serialization logic.
//!
//! This module handles the wire protocol format used between Soko Desktop and Mobile.
//! Every packet starts with a 2-byte magic ("SK"), protocol version, packet sequence ID,
//! timestamp, and an explicit packet type.

use serde::{Deserialize, Serialize};

/// Application packet type tags.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PacketType {
    /// Heartbeat ping from mobile to maintain link liveness.
    HeartbeatPing,
    /// Heartbeat pong response from desktop.
    HeartbeatPong,
    /// Initial pairing request containing ephemeral public key.
    PairRequest,
    /// Confirmation of SAS / 6-digit confirmation code.
    PairConfirm,
    /// Mobile notification mirrored to desktop island.
    NotificationPost,
    /// Dismiss request for a mirrored notification.
    NotificationDismiss,
    /// Trigger a pre-configured or whitelisted CLI command.
    CliExecute,
    /// Stream chunk containing stdout/stderr from a running CLI agent.
    CliOutputStream,
    /// Command execution finished (includes exit code).
    CliTerminated,
    /// Offer to transfer a file (APK, image, document) via Hotspot/LAN.
    FileOffer,
    /// Streaming progress updates for file transfers.
    FileProgress,
    /// File transfer has been completed and verified.
    FileCompleted,
}

/// Standardized envelope structure for all exchanged packets.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SokoEnvelope {
    /// Protocol magic marker: always "SK".
    pub magic: String,
    /// Protocol schema version (currently 1).
    pub version: u32,
    /// Monotonically increasing sequence number (protects against replay attacks).
    pub packet_id: u64,
    /// Unix epoch timestamp in milliseconds when packet was generated.
    pub timestamp: u64,
    /// Message category.
    pub packet_type: PacketType,
    /// JSON payload content matching the packet_type.
    pub payload: serde_json::Value,
}

impl SokoEnvelope {
    /// Creates a new outgoing packet envelope with automatic timestamping.
    ///
    /// # Arguments
    /// * `packet_id` - Monotonic counter tracked by the session manager.
    /// * `packet_type` - Type tag.
    /// * `payload` - Serializable JSON value.
    pub fn new(packet_id: u64, packet_type: PacketType, payload: serde_json::Value) -> Self {
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        Self {
            magic: "SK".to_string(),
            version: 1,
            packet_id,
            timestamp: now_ms,
            packet_type,
            payload,
        }
    }

    /// Verifies if the envelope meets protocol invariants.
    pub fn is_valid(&self) -> bool {
        self.magic == "SK" && self.version == 1
    }
}
