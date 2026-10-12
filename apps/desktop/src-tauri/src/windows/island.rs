//! Dynamic Island HUD window controller.
//!
//! Manages:
//! - Centered top-of-screen placement (`y: 0`, `x: (screen_w - width) / 2`).
//! - Always-on-top elevation (`WS_EX_TOPMOST` / `_NET_WM_STATE_ABOVE`).
//! - Physical window resizing matching UI layout morphs.
//! - Transparent margin click-through hit-testing.

use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};
use tracing::info;

/// Layout mode of the Dynamic Island.
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum IslandMode {
    /// Minimal pill showing mascot avatar and connection dot (~180x36).
    Compact,
    /// Expanded notification view with sender and action buttons (~380x84).
    Notification,
    /// Expanded CLI terminal view with spinner and stdout snippet (~420x120).
    Cli,
    /// Expanded file transfer progress view (~340x76).
    Transfer,
}

impl IslandMode {
    /// Physical pixel dimensions for each mode.
    pub fn dimensions(&self) -> (u32, u32) {
        match self {
            IslandMode::Compact => (180, 40),
            IslandMode::Notification => (380, 90),
            IslandMode::Cli => (440, 130),
            IslandMode::Transfer => (360, 80),
        }
    }
}

/// Dynamic Island controller.
pub struct IslandController;

impl IslandController {
    /// Re-centers and resizes the physical OS window to fit the active mode.
    ///
    /// This prevents transparent margins from intercepting mouse clicks
    /// when the island is in compact pill mode.
    pub fn set_mode(app: &AppHandle, mode: IslandMode) -> Result<(), String> {
        let window: WebviewWindow = app
            .get_webview_window("island")
            .ok_or_else(|| "Island window handle not found".to_string())?;

        let (target_w, target_h) = mode.dimensions();

        // Get primary monitor dimensions to position top-center
        if let Ok(Some(monitor)) = window.current_monitor() {
            let screen_w = monitor.size().width;
            let center_x = (screen_w.saturating_sub(target_w)) / 2;

            let _ = window.set_size(PhysicalSize::new(target_w, target_h));
            let _ = window.set_position(PhysicalPosition::new(center_x as i32, 0));
        }

        // Notify webview to animate components
        let _ = window.emit("island:mode-changed", mode);

        info!("Island window transitioned to {:?}", mode);
        Ok(())
    }

    /// Toggles whether cursor events pass through the window.
    pub fn set_ignore_cursor(app: &AppHandle, ignore: bool) -> Result<(), String> {
        let window: WebviewWindow = app
            .get_webview_window("island")
            .ok_or_else(|| "Island window handle not found".to_string())?;

        window
            .set_ignore_cursor_events(ignore)
            .map_err(|e| format!("Failed to set cursor pass-through: {}", e))
    }
}
