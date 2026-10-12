//! Security subsystem: Cryptography, session tokens, and pairing auth.

pub mod auth;
pub mod crypto;

pub use auth::{AuthService, TrustedDevice};
pub use crypto::{decrypt_payload, encrypt_payload, generate_nonce};
