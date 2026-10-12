//! Cryptographic primitives: AES-256-GCM authenticated encryption and nonces.

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::RngCore;

/// Generates a random 12-byte initialization vector (IV / Nonce).
pub fn generate_nonce() -> [u8; 12] {
    let mut nonce = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce);
    nonce
}

/// Encrypts an arbitrary plaintext payload using AES-256-GCM.
///
/// # Arguments
/// * `key` - 32-byte shared symmetric key derived during pairing.
/// * `nonce` - 12-byte initialization vector.
/// * `plaintext` - Raw bytes to encrypt.
pub fn encrypt_payload(key: &[u8; 32], nonce: &[u8; 12], plaintext: &[u8]) -> Result<Vec<u8>, String> {
    let cipher = Aes256Gcm::new(key.into());
    let nonce = Nonce::from_slice(nonce);

    cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| format!("AES-256-GCM encryption failed: {}", e))
}

/// Decrypts and authenticates a ciphertext payload using AES-256-GCM.
pub fn decrypt_payload(key: &[u8; 32], nonce: &[u8; 12], ciphertext: &[u8]) -> Result<Vec<u8>, String> {
    let cipher = Aes256Gcm::new(key.into());
    let nonce = Nonce::from_slice(nonce);

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("AES-256-GCM decryption / authentication failed: {}", e))
}
