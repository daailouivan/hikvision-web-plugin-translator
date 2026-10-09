# Hikvision & Annke Web Plugin Translator

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-brightgreen.svg)](extension/manifest.json)
[![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20macOS%20%7C%20Windows-orange.svg)](#)
[![Version](https://img.shields.io/badge/Release-v1.0.5-blue.svg)](#)

A modern, cross-platform **Manifest V3 WebExtension** that seamlessly translates and virtualizes Hikvision & Annke's legacy plugin protocol (`LocalServiceComponents.exe` / `WebComponents.exe` / NPAPI) into native **HTML5 Canvas and WebCodecs** directly inside modern web browsers.

**Runs with zero native binaries, zero Wine, and zero background services required.**

---

## 📌 The Problem

1. Modern web browsers (Chrome, Brave, Edge, Firefox) deprecated NPAPI and ActiveX plugins years ago.
2. Hikvision and Annke attempted to solve this by releasing Windows-only helper binaries (`LocalServiceComponents.exe` / `LocalServiceControl.exe`). These executables run a local loopback web server on ports `33686–33695` and draw Win32 window overlays on top of the browser viewport.
3. As a result, **Linux, macOS, and ChromeOS users are completely locked out** from viewing live video or playback on their NVRs and cameras, stuck on an endless prompt: *"Please click here to download and install the plug-in."*

---

## 💡 The Solution

This extension completely eliminates the need for any native installer or background daemon by translating the legacy protocol entirely in browser memory:

```
┌────────────────────────────────────────────────────────┐
│               Hikvision / Annke Web Page               │
│               (preview.asp / playback.asp)             │
└───────────┬────────────────────────────────┬───────────┘
            │ 1. Port Probes                 │ 2. WebSocket IPC
            ▼                                ▼
┌────────────────────────────────────────────────────────┐
│         Web Plugin Translator (In-Page Hook)          │
│  - Spoofs 127.0.0.1:33686-33695 Image Probes & XHR     │
│  - Virtual WebSocket Server running in JS memory       │
│  - Satisfies detectport & system.webconnect handshake  │
└───────────────────────────┬────────────────────────────┘
                            │ Dispatches Layout & Streams
                            ▼
┌────────────────────────────────────────────────────────┐
│           In-DOM Multi-Window Grid Manager             │
│  - Dynamic 1x1, 2x2, 3x3, 4x4 Grid Tiles               │
│  - Interactive Window Focus (Highlight & Route)        │
│  - Hover Quick Actions (Snapshot, Zoom, Close)         │
│  - WebCodecs / HTML5 Canvas Hardware Accelerated Video │
└────────────────────────────────────────────────────────┘
```

---

## ✨ Features

- **🚀 100% Native In-Browser Execution**:
  No Wine, no external Python/Node daemons, no Windows virtual machines. Works seamlessly on Linux, macOS, ChromeOS, and Windows.
- **🖥️ Multi-Window Grid Manager**:
  Supports standard NVR grid layouts:
  - **1x1** (Single window)
  - **2x2** (4-split)
  - **3x3** (9-split)
  - **4x4** (16-split)
- **🎯 Interactive Window Focus**:
  Click any window tile to highlight it in blue. Clicking or double-clicking any camera from the left sidebar channel list routes the stream directly into the selected tile.
- **🔍 Instant Zoom & Restore**:
  Double-click any tile to zoom to 100% full view inside the container. Double-click again to restore the multi-split grid.
- **⚡ Hover Quick Action Toolbar**:
  Each camera tile features a sleek floating action bar on hover:
  - 📷 **Instant Snapshot**: Downloads high-resolution JPEG directly.
  - ⛶ **Zoom / Restore**: Toggles full tile view.
  - ✕ **Close Stream**: Stops the active stream and resets the tile.
- **📊 Real-Time On-Screen Display (OSD)**:
  Displays the camera channel name (e.g. `Front Left [CH 1]`), illuminated live badge, active resolution, and real-time FPS counter (`704x576 • 25fps`).
- **🎨 Sleek Idle Placeholders**:
  Unconfigured or stopped tiles display clean CCTV camera placeholders rather than pitch-black voids.
- **🛑 Zero Accidental Auto-Play**:
  Default configuration suppresses unwanted startup streams (`realPlayAll: "0"`), loading into a clean idle grid until you choose what to watch.
- **⏪ Playback & Time Synchronization**:
  Emulates `video.getOSDTime` and `video.getPlayInfo`, enabling the timeline scrubber and playback controls on `/doc/page/playback.asp`.
- **📸 Fullscreen & Recording**:
  Synchronizes fullscreen states with the NVR bottom toolbar and supports live WebM clip recording via `MediaRecorder`.

---

## 📦 Installation

### Chrome, Brave, Microsoft Edge, Opera (Chromium-based)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/daailouivan/hikvision-web-plugin-translator.git
   ```
2. Open your browser's extension management page:
   - **Chrome**: `chrome://extensions`
   - **Brave**: `brave://extensions`
   - **Edge**: `edge://extensions`
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked**.
5. Select the `extension/` folder inside the cloned repository.
6. Open your NVR or camera web interface (e.g. `http://192.168.1.64` or `http://192.168.88.101`).
7. Enjoy native HTML5 streaming!

### Pre-Packaged Zip Release

Download `annke-hikvision-bridge-v1.0.5.zip` from Releases, unzip it, and use **Load unpacked** pointing to the extracted folder.

---

## 🔒 Security & Privacy

- All video decoding and protocol translation occurs **strictly locally** inside your browser.
- No video feeds, tokens, credentials, or telemetry are ever transmitted to any external server.
- Manifest V3 compliant with minimal required permissions.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
