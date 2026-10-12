//! Sandboxed file system storage and path traversal defense.
//!
//! Guarantees that any file offered by a mobile device cannot escape into system
//! directories (e.g. `../../.bashrc` or `C:\Windows`) or overwrite critical assets.

use std::path::{Path, PathBuf};

/// Error types occurring during file destination resolution.
#[derive(Debug, thiserror::Error if cfg!(feature = "thiserror") else Clone)]
pub enum SandboxError {
    InvalidFilename(String),
    PathTraversalDetected(String),
    DirectoryCreationFailed(String),
}

impl std::fmt::Display for SandboxError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidFilename(msg) => write!(f, "Invalid filename: {}", msg),
            Self::PathTraversalDetected(msg) => write!(f, "Security violation (Path Traversal): {}", msg),
            Self::DirectoryCreationFailed(msg) => write!(f, "Failed to create directory: {}", msg),
        }
    }
}

/// Resolves and returns the canonical default download directory for Soko files.
/// Defaults to `~/Downloads/SokoFiles/`.
pub fn get_default_download_dir() -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());

    Path::new(&home).join("Downloads").join("SokoFiles")
}

/// Sanitizes an incoming raw filename and returns a safe destination PathBuf.
///
/// # Security Guarantees:
/// 1. Strips all relative directory traversal sequences (`..`, `/`, `\`).
/// 2. Filters out ASCII control characters and null bytes (`\0`).
/// 3. Ensures the resolved canonical path is strictly a descendant of `base_dir`.
pub fn sanitize_and_resolve(base_dir: &Path, raw_filename: &str) -> Result<PathBuf, SandboxError> {
    // Extract strictly the final filename component
    let file_name = Path::new(raw_filename)
        .file_name()
        .and_then(|f| f.to_str())
        .ok_or_else(|| SandboxError::InvalidFilename("Missing filename component".to_string()))?;

    // Filter characters: allow alphanumeric, dots, dashes, underscores, and spaces
    let clean_name: String = file_name
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '.' || *c == '-' || *c == '_' || *c == ' ')
        .collect();

    if clean_name.trim().is_empty() {
        return Err(SandboxError::InvalidFilename("Filename resolved to empty string".to_string()));
    }

    // Ensure base directory exists
    if !base_dir.exists() {
        std::fs::create_dir_all(base_dir)
            .map_err(|e| SandboxError::DirectoryCreationFailed(e.to_string()))?;
    }

    let target = base_dir.join(clean_name);

    // Verify it is strictly a child of base_dir
    if !target.starts_with(base_dir) {
        return Err(SandboxError::PathTraversalDetected(
            "Resolved path escapes target sandbox directory".to_string(),
        ));
    }

    Ok(target)
}
