// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use std::process::{Command, Child};
use std::fs;
use std::path::Path;
use std::sync::Mutex;

struct AppState {
    server_child: Mutex<Option<Child>>,
}

fn resolve_resource(app: &tauri::App, rel: &str) -> Option<std::path::PathBuf> {
    // 1) Try Tauri resource directory
    if let Ok(p) = app.path().resolve(rel, tauri::path::BaseDirectory::Resource) {
        if std::path::Path::new(&p).exists() {
            return Some(p);
        }
    }
    // 2) Fallbacks near the executable (covers Linux "app" target layouts like _up_)
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let candidates = [
                dir.join(rel),                  // alongside binary
                dir.join("_up_").join(rel),      // Linux "_up_" resources dir
                dir.join("../resources").join(rel), // typical resources dir
            ];
            for cand in candidates {
                if cand.exists() {
                    return Some(cand);
                }
            }
        }
    }
    None
}

fn main() {
    tauri::Builder::default()
        .manage(AppState { server_child: Mutex::new(None) })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // Kill the server child process when the window is closing
                if let Ok(mut child_guard) = window.app_handle().state::<AppState>().server_child.lock() {
                    if let Some(c) = &mut *child_guard {
                        let _ = c.kill();
                    }
                }
            }
        })
        .setup(|app| {
            // Resolve embedded server runtime bits (optional: only spawn if present)
            let node_path = resolve_resource(app, "node");
            let service_dir = resolve_resource(app, "service-dist");

            // Try embedded first
            let mut spawned = false;
            if let (Some(node_path), Some(service_dir)) = (node_path, service_dir) {
                // Ensure app data dir exists and set DB path via env so knex uses it
                let db_path = app.path().resolve("dev.sqlite3", tauri::path::BaseDirectory::AppData).unwrap();
                println!("Tauri (dev fallback) setting DB Path to: {}", db_path.display());
                if let Some(parent) = Path::new(&db_path).parent() {
                    let _ = fs::create_dir_all(parent);
                }

                // Spawn Node service: node src/index.js
                let child = Command::new(&node_path)
                    .current_dir(&service_dir)
                    .env("DATABASE_PATH", &db_path)
                    .env("PORT", "3001")
                    .arg("src/index.js")
                    .spawn()
                    .expect("failed to spawn embedded server (node src/index.js)");

                // Store the child in state
                let state = app.state::<AppState>();
                *state.server_child.lock().unwrap() = Some(child);
                spawned = true;
            }

            // If not spawned (e.g., in dev), try to spawn from source assuming node is available
            if !spawned {
                // Assume service is at ../../../service relative to the binary
                if let Ok(exe) = std::env::current_exe() {
                    if let Some(dir) = exe.parent() {
                        let service_dir = dir.join("../../../service");
                        if service_dir.exists() {
                            let db_path = app.path().resolve("dev.sqlite3", tauri::path::BaseDirectory::AppData).unwrap();
                            if let Some(parent) = Path::new(&db_path).parent() {
                                let _ = fs::create_dir_all(parent);
                            }

                            let child = Command::new("node")
                                .current_dir(&service_dir)
                                .env("DATABASE_PATH", &db_path)
                                .env("PORT", "3001")
                                .arg("src/index.js")
                                .stdout(std::process::Stdio::inherit())
                                .stderr(std::process::Stdio::inherit())
                                .spawn()
                                .expect("failed to spawn dev server (node src/index.js)");

                            let state = app.state::<AppState>();
                            *state.server_child.lock().unwrap() = Some(child);
                        }
                    }
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
