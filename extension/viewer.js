/**
 * Standalone Camera Viewer Logic
 */

document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("playerCanvas");
  const player = new CameraStreamPlayer(canvas);

  const camHost = document.getElementById("camHost");
  const camPort = document.getElementById("camPort");
  const camProto = document.getElementById("camProto");
  const camUser = document.getElementById("camUser");
  const camPass = document.getElementById("camPass");
  const camChannel = document.getElementById("camChannel");
  const connectBtn = document.getElementById("connectBtn");
  const streamStatus = document.getElementById("streamStatus");
  const osdFps = document.getElementById("osdFps");
  const osdRes = document.getElementById("osdRes");
  const placeholderOverlay = document.getElementById("placeholderOverlay");

  const snapBtn = document.getElementById("snapBtn");
  const recBtn = document.getElementById("recBtn");
  const fullBtn = document.getElementById("fullBtn");
  const resetZoomBtn = document.getElementById("resetZoomBtn");

  // Load saved credentials
  chrome.storage.local.get(["camHost", "camPort", "camProto", "camUser", "camPass", "camChannel"], (cfg) => {
    if (cfg.camHost) camHost.value = cfg.camHost;
    if (cfg.camPort) camPort.value = cfg.camPort;
    if (cfg.camProto) camProto.value = cfg.camProto;
    if (cfg.camUser) camUser.value = cfg.camUser;
    if (cfg.camPass) camPass.value = cfg.camPass;
    if (cfg.camChannel) camChannel.value = cfg.camChannel;
  });

  function saveConfig() {
    chrome.storage.local.set({
      camHost: camHost.value.trim(),
      camPort: camPort.value.trim(),
      camProto: camProto.value,
      camUser: camUser.value.trim(),
      camPass: camPass.value,
      camChannel: camChannel.value
    });
  }

  // OSD update loop
  setInterval(() => {
    if (player.isPlaying) {
      osdFps.textContent = `${player.fps} FPS`;
      if (canvas.width > 0 && canvas.height > 0) {
        osdRes.textContent = `${canvas.width}x${canvas.height}`;
      }
    }
  }, 1000);

  connectBtn.addEventListener("click", async () => {
    saveConfig();

    if (player.isPlaying) {
      player.stop();
      connectBtn.textContent = "Connect & Play";
      connectBtn.className = "btn btn-primary";
      streamStatus.textContent = "Disconnected";
      streamStatus.className = "status-indicator";
      placeholderOverlay.style.display = "block";
      return;
    }

    const host = camHost.value.trim();
    const port = camPort.value.trim();
    const proto = camProto.value;
    const user = camUser.value.trim();
    const pass = camPass.value;
    const origin = `${proto}://${host}:${port}`;
    let userInfo = "";
    if (user && pass) {
      userInfo = btoa(`${user}:${pass}`);
    }

    streamStatus.textContent = "Connecting...";
    streamStatus.className = "status-indicator";
    placeholderOverlay.style.display = "none";

    try {
      connectBtn.textContent = "Stop Stream";
      connectBtn.className = "btn btn-secondary";
      streamStatus.textContent = "LIVE";
      streamStatus.className = "status-indicator live";

      await player.play("", {
        channel: channel,
        origin: origin,
        userInfo: userInfo
      });
    } catch (err) {
      console.error("Stream failed:", err);
      streamStatus.textContent = "Error: " + err.message;
      streamStatus.className = "status-indicator";
      connectBtn.textContent = "Connect & Play";
      connectBtn.className = "btn btn-primary";
      placeholderOverlay.style.display = "block";
    }
  });

  // Snapshot
  snapBtn.addEventListener("click", () => {
    if (player.isPlaying) {
      player.downloadSnapshot(`camera_snap_${Date.now()}.jpg`);
    }
  });

  // Recording
  recBtn.addEventListener("click", () => {
    if (!player.isPlaying) return;
    if (!player.isRecording) {
      player.startRecording();
      recBtn.textContent = "Stop Recording";
      recBtn.style.backgroundColor = "#dc2626";
    } else {
      player.stopRecording();
      recBtn.textContent = "Start Recording";
      recBtn.style.backgroundColor = "";
    }
  });

  // Fullscreen
  fullBtn.addEventListener("click", () => {
    if (!document.fullscreenElement) {
      canvas.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  // Reset digital zoom
  resetZoomBtn.addEventListener("click", () => {
    player.zoomLevel = 1.0;
    player.panX = 0;
    player.panY = 0;
  });

  // PTZ Control sender
  async function sendPtz(pan, tilt, zoom) {
    const host = camHost.value.trim();
    const port = camPort.value.trim();
    const proto = camProto.value;
    const user = camUser.value.trim();
    const pass = camPass.value;
    const channel = camChannel.value.substring(0, 1) || "1";

    const ptzUrl = `${proto}://${host}:${port}/ISAPI/PTZCtrl/channels/${channel}/continuous`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?><PTZData><pan>${pan}</pan><tilt>${tilt}</tilt><zoom>${zoom}</zoom></PTZData>`;

    const headers = { "Content-Type": "application/xml" };
    if (user && pass) {
      headers["Authorization"] = "Basic " + btoa(`${user}:${pass}`);
    }

    try {
      await fetch(ptzUrl, { method: "PUT", headers: headers, body: xml });
    } catch (e) {
      console.warn("PTZ request failed:", e);
    }
  }

  // PTZ Buttons
  document.getElementById("ptzUp").addEventListener("mousedown", () => sendPtz(0, 50, 0));
  document.getElementById("ptzDown").addEventListener("mousedown", () => sendPtz(0, -50, 0));
  document.getElementById("ptzLeft").addEventListener("mousedown", () => sendPtz(-50, 0, 0));
  document.getElementById("ptzRight").addEventListener("mousedown", () => sendPtz(50, 0, 0));
  document.getElementById("ptzZoomIn").addEventListener("mousedown", () => sendPtz(0, 0, 50));
  document.getElementById("ptzZoomOut").addEventListener("mousedown", () => sendPtz(0, 0, -50));
  
  // Stop PTZ on mouseup
  const stopPtz = () => sendPtz(0, 0, 0);
  window.addEventListener("mouseup", stopPtz);
  document.getElementById("ptzStop").addEventListener("click", stopPtz);
});
