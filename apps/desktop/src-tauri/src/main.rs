// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;
use tauri::Manager;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use soko_desktop_lib::{
    bluetooth::BleService,
    cli::{CliExecutor, WhitelistConfig},
    security::AuthService,
    transfer::FileReceiver,
    AppState,
};

fn main() {
    // Initialize structured tracing
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .with(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let (ble_service, _inbound_rx) = BleService::new();
    ble_service.start_daemon();

    let app_state = AppState {
        ble: Arc::new(ble_service),
        cli_executor: Arc::new(CliExecutor::new()),
        whitelist: Arc::new(parking_lot::RwLock::new(WhitelistConfig::default())),
        auth: Arc::new(AuthService::new()),
        file_receiver: Arc::new(FileReceiver::new()),
    };

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            soko_desktop_lib::set_island_mode,
            soko_desktop_lib::show_settings,
            soko_desktop_lib::hide_settings,
            soko_desktop_lib::execute_command,
            soko_desktop_lib::download_file,
            soko_desktop_lib::confirm_pairing,
        ])
        .setup(|app| {
            // Apply initial position for Dynamic Island (top center)
            if let Some(window) = app.get_webview_window("island") {
                if let Ok(Some(monitor)) = window.current_monitor() {
                    let screen_w = monitor.size().width;
                    let island_w = 420;
                    let center_x = (screen_w.saturating_sub(island_w)) / 2;
                    let _ = window.set_position(tauri::PhysicalPosition::new(center_x as i32, 0));
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Soko desktop application");
}
