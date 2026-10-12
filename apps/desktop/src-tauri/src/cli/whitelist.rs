//! Whitelist configuration and security validation for remote CLI execution.
//!
//! To prevent Remote Code Execution (RCE) attacks from malicious or hijacked
//! Bluetooth links, Soko forbids arbitrary shell string evaluation.
//! Instead, all executable operations must be explicitly defined in a whitelist manifest.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Representation of an authorized command.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhitelistedCommand {
    /// Unique alias ID referenced by the mobile app (e.g., 'agy-status').
    pub id: String,
    /// Human-readable label displayed on the mobile terminal deck.
    pub title: String,
    /// Binary executable name (e.g. 'agy', 'git', 'cargo').
    pub program: String,
    /// Exact fixed arguments passed to the program.
    pub args: Vec<String>,
    /// Optional working directory path (defaults to user home if None).
    pub working_dir: Option<String>,
    /// Whether execution requires mobile biometric (fingerprint/face) unlock.
    pub requires_biometrics: bool,
}

/// Registry storing authorized commands.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhitelistConfig {
    /// Configuration format version.
    pub version: u32,
    /// Map of command aliases to their definitions.
    pub commands: HashMap<String, WhitelistedCommand>,
}

impl Default for WhitelistConfig {
    /// Generates the default out-of-the-box configuration with safe defaults
    /// including Antigravity CLI and standard developer utilities.
    fn default() -> Self {
        let mut commands = HashMap::new();

        commands.insert(
            "agy-status".to_string(),
            WhitelistedCommand {
                id: "agy-status".to_string(),
                title: "Antigravity Status".to_string(),
                program: "agy".to_string(),
                args: vec!["status".to_string()],
                working_dir: None,
                requires_biometrics: false,
            },
        );

        commands.insert(
            "agy-run".to_string(),
            WhitelistedCommand {
                id: "agy-run".to_string(),
                title: "Antigravity Autonomous Run".to_string(),
                program: "agy".to_string(),
                args: vec!["run".to_string()],
                working_dir: None,
                requires_biometrics: true, // Requires fingerprint confirmation
            },
        );

        commands.insert(
            "git-status".to_string(),
            WhitelistedCommand {
                id: "git-status".to_string(),
                title: "Git Status Check".to_string(),
                program: "git".to_string(),
                args: vec!["status".to_string(), "--short".to_string()],
                working_dir: None,
                requires_biometrics: false,
            },
        );

        commands.insert(
            "sys-lock".to_string(),
            WhitelistedCommand {
                id: "sys-lock".to_string(),
                title: "Lock Computer Screen".to_string(),
                program: if cfg!(target_os = "windows") {
                    "rundll32.exe".to_string()
                } else {
                    "loginctl".to_string()
                },
                args: if cfg!(target_os = "windows") {
                    vec!["user32.dll,LockWorkStation".to_string()]
                } else {
                    vec!["lock-session".to_string()]
                },
                working_dir: None,
                requires_biometrics: false,
            },
        );

        Self {
            version: 1,
            commands,
        }
    }
}

impl WhitelistConfig {
    /// Validates whether a command ID is allowed.
    pub fn get_command(&self, id: &str) -> Option<&WhitelistedCommand> {
        self.commands.get(id)
    }

    /// Adds or updates an authorized command in the registry.
    pub fn register(&mut self, cmd: WhitelistedCommand) {
        self.commands.insert(cmd.id.clone(), cmd);
    }
}
