# Hikvision & Annke Web Plugin Translator

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-brightgreen.svg)](extension/manifest.json)
[![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20macOS%20%7C%20Windows-orange.svg)](#)
[![Version](https://img.shields.io/badge/Release-v1.2.0-blue.svg)](#)

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
│  - PSIA Track Index Offset Resolution (N+1)            │
└───────────────────────────┬────────────────────────────┘
                            │ Dispatches Layout & Streams
                            ▼
┌────────────────────────────────────────────────────────┐
│           In-DOM Multi-Window Grid Manager             │
│  - Dynamic 1x1, 2x2, 3x3, 4x4 Grid Tiles               │
│  - ZeroChannel 01: Authentic 8-CH Composite Multi-View │
│  - Full HD 1080p Main Stream (Channel 101/201/...)     │
│  - Authentic Fluent Sub-Stream (Channel 102/202/...)   │
│  - Interactive Window Focus (Highlight & Route)        │
│  - Tile Quick Actions ([HD]/[SD], Snapshot, Zoom, Stop)│
│  - WebCodecs / HTML5 Canvas Hardware Accelerated Video │
└────────────────────────────────────────────────────────┘
```

---

## ✨ Features

- **🚀 100% Native In-Browser Execution**:
  No Wine, no external Python/Node daemons, no Windows virtual machines. Works seamlessly on Linux, macOS, ChromeOS, and Windows.
- **⏱️ Synchronized Multi-Grid Playback (Lockstep 1-Time Sync)**:
  Eliminates independent playback drift across multi-camera layouts. In 4-split or 9-split grids, pick a single universal timestamp (`[ 🕒 HH : MM : SS ]`) and click **▶ Play All in Sync** to launch all active camera grids simultaneously in lockstep at razor-sharp 1080p Full HD.
- **⚡ 1-Click Playback Auto-Fill (`⚡ Fill 1–4`, `⚡ Fill 1–8`)**:
  Eliminates tedious manual click cycles. Automatically selects channels, provisions multi-split grids, and assigns camera feeds in a single click from the playback toolbar or sidebar quick bar.
- **⏩ Auto-Advancing Channel Selection (Independent Mode)**:
  Assigning a channel to the active grid tile in Independent mode automatically advances focus to the next available window slot, allowing rapid sequential assignment without manual tile re-selection.
- **⏹ 1-Click Clear / Stop**:
  Instantly halts all active playback feeds and resets channel checkboxes with a single click.
- **🎛️ ZeroChannel Multi-View Composite Matrix**:
  Selecting **ZeroChannel 01** renders an authentic 8-camera multi-view composite matrix (3x3 grid) with live camera headers, timestamps, and status overview, accurately replicating the NVR's hardware zero-channel without displaying single-camera channel 1.
- **📺 True Full HD (1080p) Main Stream**:
  Resolves the NVR snapshot proxy scaler default limitation (`704x576`) by explicitly commanding full 1920x1080 parameters for Main Stream channels (`101`, `201`, etc.), delivering razor-sharp video feeds.
- **⚡ Authentic Fluent Sub-Stream (SD)**:
  Corrects the PSIA track offset mapping (`ISAPI_channel = trackIndex + 1`), ensuring Sub-Stream requests (`102`, `202`, etc.) respect NVR Video/Audio rules at native sub-stream resolution (`704x576` / `640x480`) without being forced to 1080p.
- **🎚️ Dynamic [HD] / [SD] / [ZERO] Stream Quality Toggle**:
  Each tile features an interactive on-screen quality toggle badge:
  - **HD**: Full resolution 1080p Main Stream for maximum detail.
  - **SD**: Fluent 4CIF/VGA Sub Stream for low network load and dense grids.
  - **ZERO**: Dedicated ZeroChannel multi-view badge.
  - **Auto-Promotion**: Double-clicking to maximize a tile automatically upgrades it to Full HD Main Stream.
- **🔲 Seamless Grid Confine Fit (Zero Black Bars)**:
  Eliminates letterboxing and pillarboxing across all split grids (1x1, 2x2, 3x3, 4x4) by fitting each video canvas directly to the tile's rectangular confines, matching the display behavior of native CCTV surveillance consoles.
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
  - 🎚️ **HD / SD Toggle**: Switch instantly between Full HD (1080p) and Fluent Sub Stream.
  - 📷 **Instant Snapshot**: Downloads high-resolution JPEG directly.
  - ⛶ **Zoom / Restore**: Toggles full tile view.
  - ✕ **Close Stream**: Stops the active stream and resets the tile.
- **📊 Real-Time On-Screen Display (OSD)**:
  Displays the camera channel name (e.g. `Front Left [CH 1]`), illuminated live badge, active resolution and quality tag, and real-time FPS counter (`1920x1080 [HD] • 5fps`).
- **🎨 Sleek Idle Placeholders**:
  Unconfigured or stopped tiles display clean CCTV camera placeholders rather than pitch-black voids.
- **⚙️ Complete Local Configuration Persistence**:
  Full emulation of `video.getLocalConfig` and `video.setLocalConfig` backed by persistent local storage. Reliably preserves **Image Size** (`Auto-fill`, `4:3`, `16:9`), **Auto Start Live View** (`Yes`/`No`), buffer size, package size, and snapshot directories without resetting.
- **🧹 Multi-Page DOM & Viewport Hygiene**:
  Completely purges stray video boxes, canvas leaks, and unneeded player containers on non-video management tabs (Configuration -> Local, Maintenance, Camera Management, User Management, Network Advanced Services). Video elements are strictly isolated to active preview and playback viewports.
- **⚡ High-FPS Pipelined Stream Engine (10–15 FPS)**:
  Replaced sluggish single-request serial polling (~3 FPS) with an asynchronous pipelined multi-worker streaming engine (3–4 in-flight requests with monotonic sequence ordering). Delivers a 300%–400% framerate increase for fluid, responsive real-time video playback.
- **📐 Authentic 640x480 Sub-Stream Conforming**:
  Conforms decoded sub-stream frames to the camera's true configured resolution (640x480 4:3 VGA for standard channels; 1280x720 for Channel 7), bypassing the NVR hardware's distorted default PAL 4CIF (704x576) scaler.
- **🔲 Non-Interfering Selection Overlay**:
  Upgraded window focus selection to use an isolated overlay (`::after`), ensuring window selection never shrinks the video canvas or causes grid layout shifts.
- **🚀 Concurrent Parallel ZeroChannel Matrix**:
  All 8 camera feeds in the ZeroChannel composite multi-view stream concurrently in parallel instead of one-by-one round-robin.
- **🛑 Zero Accidental Auto-Play**:
  Default configuration suppresses unwanted startup streams (`realPlayAll: "0"`), loading into a clean idle grid until you choose what to watch.
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

Download `annke-hikvision-bridge-v1.2.0.zip` (or `hikvision-web-plugin-translator-v1.2.0.zip`) from Releases, unzip it, and use **Load unpacked** pointing to the extracted folder.

---

## 🔒 Security & Privacy

- All video decoding and protocol translation occurs **strictly locally** inside your browser.
- No video feeds, tokens, credentials, or telemetry are ever transmitted to any external server.
- Manifest V3 compliant with minimal required permissions.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
