//! Multi-window coordination subsystem.

pub mod island;
pub mod settings;

pub use island::{IslandController, IslandMode};
pub use settings::SettingsController;
