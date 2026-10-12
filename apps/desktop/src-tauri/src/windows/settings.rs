//! Settings window controller.

use tauri::{AppHandle, Manager, WebviewWindow};

pub struct SettingsController;

impl SettingsController {
    /// Opens and focuses the full settings window.
    pub fn show(app: &AppHandle) -> Result<(), String> {
        let window: WebviewWindow = app
            .get_webview_window("settings")
            .ok_or_else(|| "Settings window handle not found".to_string())?;

        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Hides the settings window without terminating the application.
    pub fn hide(app: &AppHandle) -> Result<(), String> {
        let window: WebviewWindow = app
            .get_webview_window("settings")
            .ok_or_else(|| "Settings window handle not found".to_string())?;

        window.hide().map_err(|e| e.to_string())?;
        Ok(())
    }
}
