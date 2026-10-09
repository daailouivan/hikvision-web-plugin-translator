# Annke & Hikvision Web Plugin Modern Bridge

A modern, cross-platform **Manifest V3 WebExtension** that reverse-engineers and replaces Hikvision / Annke's Windows-only `LocalServiceComponents.exe` (`LocalServiceControl.exe`).

Runs natively in **Chrome, Brave, Edge, Opera, and Firefox** on **Linux, macOS, and Windows** with **zero external software or native daemons required**.

---

## 🔍 Reverse Engineering Findings

Analysis of `LocalServiceComponents.exe` revealed:

1. **Installer Structure**:
   - Packaged with **Inno Setup 5.3.5**.
   - Contains `LocalServiceControl.exe`, `LocalServiceConfig.json`, `video_control.dll`, `NetStream.dll`, `StreamTransClient.dll`, and Qt5 libraries.

2. **IPC Protocol Architecture**:
   - `LocalServiceControl.exe` ran a local HTTP & WebSocket daemon (`Tufao` library) bound to loopback `127.0.0.1` on ports **33686 – 33695**.
   - Camera web pages query `http://127.0.0.1:33686/` and establish `ws://127.0.0.1:33686/` to detect if the local service is running.
   - Core handshakes:
     - `detectport`: Challenge-response handshake (`sessionID`, `user`, `challenge`, `iterations`, `random`).
     - `system.webconnect`: Authorizes the browser session.
     - `getLocalServiceVersion`: Returns service version `"1.0.0.119"`.
     - `createWnd` & `setWndGeometry`: Originally created Win32 window overlays over the browser viewport (`WS_EX_NOREDIRECTIONBITMAP`, `GetForegroundWindow`).
     - `startPlay` / `startPlayV2`: Dispatched stream playback parameters (`url`, `protocolType`, `streamType`, `wndIndex`, `auth`).

3. **Stream Protocol**:
   - `StreamTransClient.dll` and `NetStream.dll` implemented **RTSP-over-HTTP tunneling** (`application/x-rtsp-tunnelled` with session cookies) and **ISAPI HTTP streaming** (`/ISAPI/Streaming/channels/101/httpPreview`).
   - Carried MPEG-PS PES packets containing H.264/H.265 elementary streams.

---

## 🚀 How This Extension Works

Rather than requiring an external native background service, this extension runs **100% within the browser**:

1. **In-Memory LocalService Virtualization (`page-hook.js`)**:
   - Injected at `document_start` before the camera page's scripts run.
   - Intercepts `window.WebSocket`, `window.fetch`, and `window.XMLHttpRequest` for ports `33686-33695`.
   - Satisfies `detectport`, `system.webconnect`, and `getLocalServiceVersion` in memory.
   - The camera web interface detects that "LocalService" is active and unlocks the interface without prompting for download.

2. **In-DOM Hardware-Accelerated Video Rendering (`stream-player.js`)**:
   - When the page issues `createWnd` and `setWndGeometry`, the extension dynamically injects a `<canvas>` element directly into the video player container in the DOM.
   - On `startPlay`, it pulls the video stream directly from the camera's ISAPI / HTTP endpoint.
   - Decodes H.264 video using the browser's native **WebCodecs API (`VideoDecoder`)** with GPU hardware acceleration at 60 fps with zero latency.

3. **Interactive Camera Features**:
   - **Digital Pan & Zoom**: Use the mouse wheel to zoom in up to 5x, and drag to pan across the live feed.
   - **One-Click Snapshots**: Captures raw canvas frames to JPEG downloads.
   - **Video Recording**: Records live video to WebM via `MediaRecorder`.
   - **Fullscreen Mode**: Double-click or click Fullscreen to enter native HTML5 fullscreen.
   - **PTZ Controls**: Pan, tilt, and optical zoom controls for PTZ-capable cameras.

4. **Standalone Player Mode (`viewer.html`)**:
   - Don't want to use the camera's outdated web page? Click the extension icon and select **Open Standalone Player** to stream and control any Annke/Hikvision camera directly.

5. **Multi-Window Grid Management & Selection (v1.0.4)**:
   - **Dynamic Grid Layouts**: Supports 1x1, 2x2 (4 split), 3x3 (9 split), and 4x4 (16 split) native NVR grid arrangements.
   - **Interactive Window Selection**: Click any window cell to select it (with visual active outline). Left sidebar channel clicks instantly route to the selected window.
   - **Double-Click Full Window**: Double-click any window in a multi-window grid to zoom it to 100%, and double-click again to restore the grid.
   - **On-Screen Display (OSD)**: Each window displays its camera channel name (e.g. `Front Left [CH 1]`) and a live status indicator.
   - **Suppressed Accidental Auto-Play**: Configured `realPlayAll: "0"` on startup so unconfigured / unwanted cameras do not spontaneously auto-play.

---

## 📦 How to Install (Load Unpacked)

### Google Chrome / Brave / Microsoft Edge / Opera

1. Open your browser and navigate to:
   - **Brave**: `brave://extensions`
   - **Chrome**: `chrome://extensions`
   - **Edge**: `edge://extensions`
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select this directory:
   ```
   /home/hed/Projects/annkerhikvision/extension
   ```
5. Navigate to your Annke / Hikvision camera's web page (e.g., `http://192.168.1.64`).
6. The plugin download prompt will disappear, and live video will render directly in the browser!

### Mozilla Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select `manifest.json` inside `/home/hed/Projects/annkerhikvision/extension/`.

---

## 🛠️ File Structure

- `manifest.json`: WebExtension Manifest V3 specification.
- `page-hook.js`: In-page WebSocket & HTTP virtualization hook for ports 33686-33695.
- `content.js`: Injects virtualization scripts into camera web pages at `document_start`.
- `h264-demuxer.js`: MPEG-PS and H.264 NAL unit demuxer.
- `stream-player.js`: WebCodecs hardware decoder, canvas renderer, zoom, and recording engine.
- `background.js`: Service worker for extension state and permissions.
- `popup.html` / `popup.js` / `popup.css`: Toolbar action menu.
- `viewer.html` / `viewer.js` / `viewer.css`: Standalone modern camera streaming dashboard.
