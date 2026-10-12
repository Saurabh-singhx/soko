//! Asynchronous process executor with real-time output streaming.
//!
//! Executes whitelisted binaries directly via `tokio::process::Command` without
//! passing through `/bin/sh` or `cmd.exe`. Streams lines to callbacks for BLE delivery
//! and desktop Dynamic Island visual feedback.

use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::Mutex;
use tracing::{error, info, warn};

use super::whitelist::WhitelistedCommand;

/// Lifecycle status of an executing CLI task.
#[derive(Debug, Clone, serde::Serialize)]
pub enum CliExecutionState {
    Idle,
    Running {
        command_id: String,
        started_at: u64,
        last_output_line: String,
    },
    Finished {
        command_id: String,
        exit_code: i32,
        duration_ms: u64,
    },
    Failed {
        command_id: String,
        error: String,
    },
}

/// Executor service managing active CLI runs.
pub struct CliExecutor {
    /// Mutex preventing concurrent runaway executions.
    current_state: Arc<Mutex<CliExecutionState>>,
}

impl CliExecutor {
    /// Initializes a new CliExecutor.
    pub fn new() -> Self {
        Self {
            current_state: Arc::new(Mutex::new(CliExecutionState::Idle)),
        }
    }

    /// Executes a verified whitelisted command and streams output lines.
    ///
    /// # Arguments
    /// * `cmd` - The whitelisted command definition.
    /// * `on_output` - Callback invoked for every streamed stdout/stderr line.
    pub async fn execute<F>(&self, cmd: WhitelistedCommand, on_output: F) -> Result<i32, String>
    where
        F: Fn(String) + Send + Sync + 'static,
    {
        let mut state_lock = self.current_state.lock().await;

        if let CliExecutionState::Running { ref command_id, .. } = *state_lock {
            return Err(format!(
                "Cannot start '{}': task '{}' is already running.",
                cmd.id, command_id
            ));
        }

        let start_time = std::time::SystemTime::now();
        let started_at_ms = start_time
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        *state_lock = CliExecutionState::Running {
            command_id: cmd.id.clone(),
            started_at: started_at_ms,
            last_output_line: "Initializing process...".to_string(),
        };

        drop(state_lock);

        info!("Spawning CLI process: {} {:?}", cmd.program, cmd.args);

        // Build command with discrete arguments (Zero shell injection risk)
        let mut child = Command::new(&cmd.program);
        child
            .args(&cmd.args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        if let Some(ref dir) = cmd.working_dir {
            child.current_dir(dir);
        }

        let mut spawned = match child.spawn() {
            Ok(c) => c,
            Err(e) => {
                let err_msg = format!("Failed to spawn process '{}': {}", cmd.program, e);
                error!("{}", err_msg);
                let mut state_lock = self.current_state.lock().await;
                *state_lock = CliExecutionState::Failed {
                    command_id: cmd.id.clone(),
                    error: err_msg.clone(),
                };
                return Err(err_msg);
            }
        };

        // Stream stdout lines asynchronously
        if let Some(stdout) = spawned.stdout.take() {
            let mut reader = BufReader::new(stdout).lines();
            let state_clone = Arc::clone(&self.current_state);
            let cmd_id_clone = cmd.id.clone();
            let on_output_clone = Arc::new(on_output);

            tokio::spawn(async move {
                while let Ok(Some(line)) = reader.next_line().await {
                    on_output_clone(line.clone());

                    let mut s = state_clone.lock().await;
                    if let CliExecutionState::Running { ref mut last_output_line, .. } = *s {
                        *last_output_line = line;
                    }
                }
            });
        }

        // Wait for process termination with a safe 300-second timeout
        let status_res = tokio::time::timeout(tokio::time::Duration::from_secs(300), spawned.wait()).await;

        let exit_code = match status_res {
            Ok(Ok(status)) => status.code().unwrap_or(0),
            Ok(Err(e)) => {
                let err_msg = format!("Process encountered error: {}", e);
                let mut s = self.current_state.lock().await;
                *s = CliExecutionState::Failed {
                    command_id: cmd.id.clone(),
                    error: err_msg.clone(),
                };
                return Err(err_msg);
            }
            Err(_) => {
                let _ = spawned.kill().await;
                let err_msg = "Command timed out after 300 seconds and was terminated.".to_string();
                warn!("{}", err_msg);
                let mut s = self.current_state.lock().await;
                *s = CliExecutionState::Failed {
                    command_id: cmd.id.clone(),
                    error: err_msg.clone(),
                };
                return Err(err_msg);
            }
        };

        let duration_ms = start_time
            .elapsed()
            .unwrap_or_default()
            .as_millis() as u64;

        let mut s = self.current_state.lock().await;
        *s = CliExecutionState::Finished {
            command_id: cmd.id,
            exit_code,
            duration_ms,
        };

        Ok(exit_code)
    }
}
