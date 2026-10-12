//! Device authentication, Short Authentication String (SAS) derivation, and trust store.

use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Record of a trusted mobile companion device.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TrustedDevice {
    pub device_id: String,
    pub device_name: String,
    pub public_key_hex: String,
    pub paired_at: u64,
}

/// Authentication service managing paired devices and in-flight pairing sessions.
pub struct AuthService {
    trusted_devices: Arc<RwLock<HashMap<String, TrustedDevice>>>,
    active_pairing_pin: Arc<RwLock<Option<String>>>,
}

impl AuthService {
    pub fn new() -> Self {
        Self {
            trusted_devices: Arc::new(RwLock::new(HashMap::new())),
            active_pairing_pin: Arc::new(RwLock::new(None)),
        }
    }

    /// Derives a human-readable 6-digit Short Authentication String (SAS)
    /// from an ECDH shared secret to prevent Man-in-the-Middle (MITM) attacks.
    pub fn derive_sas_pin(shared_secret: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(b"SOKO_SAS_DERIVATION_V1");
        hasher.update(shared_secret);
        let hash = hasher.finalize();

        // Convert the first 4 bytes into a 6-digit integer
        let num = u32::from_be_bytes([hash[0], hash[1], hash[2], hash[3]]) % 1_000_000;
        format!("{:06}", num)
    }

    /// Stores the active pairing PIN displayed in the Dynamic Island.
    pub async fn set_active_pin(&self, pin: String) {
        *self.active_pairing_pin.write().await = Some(pin);
    }

    /// Verifies if a user confirmed the matching PIN on desktop.
    pub async fn verify_pin(&self, entered_pin: &str) -> bool {
        let guard = self.active_pairing_pin.read().await;
        guard.as_deref() == Some(entered_pin)
    }

    /// Adds a device to the trusted list upon successful pairing.
    pub async fn trust_device(&self, device: TrustedDevice) {
        self.trusted_devices.write().await.insert(device.device_id.clone(), device);
        *self.active_pairing_pin.write().await = None;
    }

    /// Checks if a device is already paired and trusted.
    pub async fn is_trusted(&self, device_id: &str) -> bool {
        self.trusted_devices.read().await.contains_key(device_id)
    }
}
