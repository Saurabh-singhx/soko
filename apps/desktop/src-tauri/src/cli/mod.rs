//! Remote CLI management and execution subsystem.
//!
//! Provides whitelist security models, PTY process spawning,
//! and live terminal stdout streaming.

pub mod executor;
pub mod whitelist;

pub use executor::{CliExecutionState, CliExecutor};
pub use whitelist::{WhitelistConfig, WhitelistedCommand};
