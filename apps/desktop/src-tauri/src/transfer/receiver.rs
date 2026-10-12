//! High-speed file pull client for mobile hotspot and local Wi-Fi transfers.
//!
//! Rather than pushing files over slow Bluetooth connections (~150 KB/s),
//! Soko initiates an outbound HTTP streaming GET directly to the mobile device's
//! local Hotspot Gateway IP (`192.168.43.1:9090`).
//!
//! Benefits:
//! - Speeds reach 30–60 MB/s (transferring a 60MB APK in ~1.5s).
//! - Zero cellular mobile data is consumed.
//! - Bypasses Windows Defender Firewall incoming connection blocks.

use futures_util::StreamExt;
use sha2::{Digest, Sha256};
use std::path::Path;
use tokio::fs::File;
use tokio::io::AsyncWriteExt;
use tracing::{error, info};

use super::sandbox::sanitize_and_resolve;

/// Status update emitted during streaming download.
#[derive(Debug, Clone, serde::Serialize)]
pub struct DownloadProgress {
    pub filename: String,
    pub bytes_downloaded: u64,
    pub total_bytes: u64,
    pub speed_bytes_per_sec: u64,
    pub percentage: f32,
}

/// High-speed file receiver service.
pub struct FileReceiver {
    http_client: reqwest::Client,
}

impl FileReceiver {
    /// Initializes a new receiver with aggressive timeouts and connection pooling.
    pub fn new() -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(120))
            .connect_timeout(std::time::Duration::from_secs(5))
            .build()
            .unwrap_or_default();

        Self { http_client }
    }

    /// Pulls a file from the mobile Hotspot HTTP server, verifying SHA-256 in-flight.
    ///
    /// # Arguments
    /// * `download_url` - Mobile HTTP endpoint (e.g. `http://192.168.43.1:9090/download?token=xyz`).
    /// * `raw_filename` - User-provided file name (e.g. `app-release.apk`).
    /// * `expected_sha256` - 64-char hexadecimal hash provided by mobile over BLE.
    /// * `dest_dir` - Destination sandbox directory.
    /// * `on_progress` - Callback invoked with download progress updates.
    pub async fn download_file<F>(
        &self,
        download_url: &str,
        raw_filename: &str,
        expected_sha256: &str,
        dest_dir: &Path,
        on_progress: F,
    ) -> Result<std::path::PathBuf, String>
    where
        F: Fn(DownloadProgress) + Send + Sync + 'static,
    {
        // 1. Sanitize destination path
        let target_path = sanitize_and_resolve(dest_dir, raw_filename)
            .map_err(|e| format!("Security check failed: {}", e))?;

        info!("Starting high-speed pull from: {}", download_url);

        // 2. Initiate outbound HTTP streaming request
        let response = self
            .http_client
            .get(download_url)
            .send()
            .await
            .map_err(|e| format!("Failed to connect to mobile hotspot server: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "Mobile HTTP server returned error: HTTP {}",
                response.status()
            ));
        }

        let total_bytes = response.content_length().unwrap_or(0);
        let mut stream = response.bytes_stream();

        // 3. Open temporary write file (.part)
        let temp_path = target_path.with_extension("part");
        let mut file = File::create(&temp_path)
            .await
            .map_err(|e| format!("Failed to create destination file: {}", e))?;

        let mut hasher = Sha256::new();
        let mut downloaded_bytes = 0u64;
        let start_time = std::time::Instant::now();
        let mut last_sample_time = std::time::Instant::now();
        let mut last_sample_bytes = 0u64;

        // 4. Stream data chunks into file and SHA-256 hasher
        while let Some(chunk_res) = stream.next().await {
            let chunk = chunk_res.map_err(|e| format!("Streaming chunk read error: {}", e))?;
            downloaded_bytes += chunk.len() as u64;

            hasher.update(&chunk);
            file.write_all(&chunk)
                .await
                .map_err(|e| format!("File write error: {}", e))?;

            // Compute transfer speed every 250ms
            if last_sample_time.elapsed().as_millis() >= 250 {
                let elapsed_secs = last_sample_time.elapsed().as_secs_f64();
                let bytes_delta = downloaded_bytes - last_sample_bytes;
                let speed = if elapsed_secs > 0.0 {
                    (bytes_delta as f64 / elapsed_secs) as u64
                } else {
                    0
                };

                let percentage = if total_bytes > 0 {
                    (downloaded_bytes as f32 / total_bytes as f32) * 100.0
                } else {
                    0.0
                };

                on_progress(DownloadProgress {
                    filename: raw_filename.to_string(),
                    bytes_downloaded: downloaded_bytes,
                    total_bytes,
                    speed_bytes_per_sec: speed,
                    percentage,
                });

                last_sample_time = std::time::Instant::now();
                last_sample_bytes = downloaded_bytes;
            }
        }

        file.flush()
            .await
            .map_err(|e| format!("File flush failed: {}", e))?;
        drop(file);

        // 5. Verify cryptographic integrity
        let computed_hash = format!("{:x}", hasher.finalize());
        if !computed_hash.eq_ignore_ascii_case(expected_sha256) {
            let _ = tokio::fs::remove_file(&temp_path).await;
            return Err(format!(
                "SHA-256 checksum mismatch! Expected {}, got {}. File discarded.",
                expected_sha256, computed_hash
            ));
        }

        // 6. Rename .part file to final destination
        tokio::fs::rename(&temp_path, &target_path)
            .await
            .map_err(|e| format!("Failed to finalize downloaded file: {}", e))?;

        let duration = start_time.elapsed();
        info!(
            "Successfully transferred '{}' ({} bytes) in {:.2?} ({:.2} MB/s)",
            raw_filename,
            downloaded_bytes,
            duration,
            (downloaded_bytes as f64 / 1_048_576.0) / duration.as_secs_f64()
        );

        Ok(target_path)
    }
}
