// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;

fn main() {
    if let Ok(current_exe) = env::current_exe() {
        if let Some(current_dir) = current_exe.parent() {
            let fixed_runtime_path = current_dir.join("webview2");
            if fixed_runtime_path.exists() && fixed_runtime_path.is_dir() {
                env::set_var("WEBVIEW2_BROWSER_EXECUTABLE_FOLDER", fixed_runtime_path);
            }
        }
    }
    app_lib::run();
}
