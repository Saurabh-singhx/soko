//! High-speed file transfer subsystem for mobile hotspot and LAN conduits.

pub mod receiver;
pub mod sandbox;

pub use receiver::{DownloadProgress, FileReceiver};
pub use sandbox::{get_default_download_dir, sanitize_and_resolve, SandboxError};
