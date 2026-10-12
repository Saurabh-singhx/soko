//! Soko Desktop Application Library & Tauri Commands.

pub mod bluetooth;
pub mod cli;
pub mod security;
pub mod transfer;
pub mod windows;

use std::sync::Arc;
use tauri::{AppHandle, Manager, State};

use bluetooth::BleService;
use cli::{CliExecutor, WhitelistConfig};
use security::AuthService;
use transfer::FileReceiver;
use windows::{IslandController, IslandMode, SettingsController};

/// Global application state managed by Tauri.
pub struct AppState {
    pub ble: Arc<BleService>,
    pub cli_executor: Arc<CliExecutor>,
    pub whitelist: Arc<parking_lot::RwLock<WhitelistConfig>>,
    pub auth: Arc<AuthService>,
    pub file_receiver: Arc<FileReceiver>,
}

#[tauri::command]
pub fn set_island_mode(app: AppHandle, mode: IslandMode) -> Result<(), String> {
    IslandController::set_mode(&app, mode)
}

#[tauri::command]
pub fn show_settings(app: AppHandle) -> Result<(), String> {
    SettingsController::show(&app)
}

#[tauri::command]
pub fn hide_settings(app: AppHandle) -> Result<(), String> {
    SettingsController::hide(&app)
}

#[tauri::command]
pub async fn execute_command(
    app: AppHandle,
    state: State<'_, AppState>,
    command_id: String,
) -> Result<i32, String> {
    let cmd = {
        let guard = state.whitelist.read();
        guard
            .get_command(&command_id)
            .cloned()
            .ok_or_else(|| format!("Command '{}' is not registered in the whitelist.", command_id))?
    };

    // Transition Dynamic Island to CLI mode
    let _ = IslandController::set_mode(&app, IslandMode::Cli);

    let app_handle_clone = app.clone();
    let executor = Arc::clone(&state.cli_executor);

    executor
        .execute(cmd, move |line| {
            let _ = app_handle_clone.emit("cli:stdout-line", line);
        })
        .await
}

#[tauri::command]
pub async fn download_file(
    app: AppHandle,
    state: State<'_, AppState>,
    url: String,
    filename: String,
    sha256: String,
) -> Result<String, String> {
    // Transition Dynamic Island to Transfer mode
    let _ = IslandController::set_mode(&app, IslandMode::Transfer);

    let dest_dir = transfer::get_default_download_dir();
    let app_clone = app.clone();

    let saved_path = state
        .file_receiver
        .download_file(&url, &filename, &sha256, &dest_dir, move |progress| {
            let _ = app_clone.emit("transfer:progress", progress);
        })
        .await?;

    Ok(saved_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn confirm_pairing(
    state: State<'_, AppState>,
    pin: String,
) -> Result<bool, String> {
    Ok(state.auth.verify_pin(&pin).await)
}
