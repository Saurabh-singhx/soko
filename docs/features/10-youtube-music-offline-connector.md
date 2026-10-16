# Feature Documentation: YouTube & YT-Music Offline Connector (Sidecar Architecture)

> **Feature Goal**: Intercept, cache, and stream high-bitrate audio (~160 kbps Opus / 128 kbps AAC) and cover art from YouTube / YouTube Music running in desktop browsers directly to Soko Mobile with sub-millisecond deduplication, zero core bloat, and full two-way remote playback control.

---

## 1. Architectural Overview & Philosophy

Soko adheres to a lightweight, zero-bloat philosophy. Rather than baking heavy web scrapers, YouTube downloaders, or complex audio indexers into Soko’s core desktop daemon (Tauri/Rust) or mobile companion (Flutter/Android), this feature is implemented as a **Decoupled Sidecar Connector**.

```
┌────────────────────────────────────────────────────────┐
│  Desktop Browser (Firefox / Chrome / Brave)           │
│  • Plays YouTube / YT Music (Muted or Paused)          │
└──────────────────────────┬─────────────────────────────┘
                           │ D-Bus MPRIS (org.mpris.MediaPlayer2)
                           ▼
┌────────────────────────────────────────────────────────┐
│  Soko Music Connector Daemon (/coding/soko-music-connector) │
│  • Fast 11-char ID Regex Extraction                   │
│  • Sub-millisecond In-Memory Set & SQLite Cache Check │
│  • yt-dlp Audio & Cover Art Worker (with cancellation) │
│  • Local Listening Analytics / Recommendation Logger  │
└──────────────────────────┬─────────────────────────────┘
                           │ WebSocket / HTTP REST
                           ▼
┌────────────────────────────────────────────────────────┐
│  Soko Universal Bridge (:8766)                         │
│  • Serves Cached Audio via HTTP 206 Partial Content    │
│  • Relays MUSIC_NOW_PLAYING & AUDIO_CONTROL Packets    │
└──────────────────────────┬─────────────────────────────┘
                           │ Local Wi-Fi / Hotspot
                           ▼
┌────────────────────────────────────────────────────────┐
│  Soko Mobile Companion                                 │
│  • Glassmorphic "Now Playing" Card in Audio Tab        │
│  • High-Bitrate Native Audio Player with Scrubbing     │
│  • Lockscreen MediaSession Integration (Art + Controls)│
└────────────────────────────────────────────────────────┘
```

---

## 2. What Lives Where & Why

| Component | Location | Role & Rationale |
| :--- | :--- | :--- |
| **Standalone Daemon** | `/home/saurabh/coding/soko-music-connector/daemon.py` | Runs in terminal, monitors D-Bus for YouTube track changes, manages `yt-dlp` child processes, and handles active skipping cancellations. |
| **Local Music Database** | `/home/saurabh/coding/soko-music-connector/db.py` | SQLite database (`music.db`) providing sub-millisecond track existence lookups and recording scrobbles for the recommendation system. |
| **HTTP 206 Byte-Range Streaming** | `/home/saurabh/coding/soko/scripts/soko_bridge.js` | Enables seekable audio streaming (`Accept-Ranges: bytes`, `206 Partial Content`) for all audio tracks in `./transfers/music/`. |
| **Now Playing Relay** | `/home/saurabh/coding/soko/scripts/soko_bridge.js` | Relays `MUSIC_NOW_PLAYING` packets between the connector and mobile clients; provides `GET /api/music/now-playing`. |
| **Now Playing Mobile Card** | `/home/saurabh/coding/soko/apps/mobile/companion/index.html` | Minimal glassmorphic widget displaying cover art, track info, audio scrubber, and lockscreen controls. |

---

## 3. Protocol & Packet Specifications

### Inbound to Bridge: `MUSIC_NOW_PLAYING`
Emitted by the connector daemon when a track starts playing or finishes downloading:
```json
{
  "magic": "SK",
  "version": 1,
  "packetId": 1729068000000,
  "timestamp": 1729068000000,
  "packetType": "MUSIC_NOW_PLAYING",
  "payload": {
    "id": "dQw4w9WgXcQ",
    "title": "Never Gonna Give You Up",
    "artist": "Rick Astley",
    "duration": 213,
    "bitrate": "160k Opus",
    "isDownloaded": true,
    "coverUrl": "/transfers/music/dQw4w9WgXcQ.jpg",
    "audioUrl": "/transfers/music/dQw4w9WgXcQ.opus",
    "source": "youtube"
  }
}
```

### Outbound from Mobile: `AUDIO_CONTROL`
Emitted when user taps Previous, Play/Pause, or Next on mobile:
```json
{
  "magic": "SK",
  "version": 1,
  "packetId": 1729068000000,
  "timestamp": 1729068000000,
  "packetType": "AUDIO_CONTROL",
  "payload": {
    "action": "play-pause"
  }
}
```

---

## 4. Key Edge Cases & Mitigations

1. **Rapid Skipping Watchdog**: If a user quickly skips 3 songs, the connector's process watchdog sends `SIGTERM` to the active `yt-dlp` child process and deletes `.part` temporary files, preventing CPU and bandwidth starvation.
2. **Ultra-Long Media Protection**: Tracks with duration > 20 minutes (or live streams) bypass full downloads and fallback to Soko's live desktop audio stream (`/api/audio/stream`).
3. **Seekable Scrubbing**: HTTP 206 Partial Content streaming guarantees that jumping to any point in the track on mobile responds in under 50ms without restarting from 0:00.
4. **Sub-Millisecond Deduplication**: Combining an in-memory Python `Set` with indexed SQLite lookups guarantees that already-downloaded tracks start playing instantly with 0 wait time.
