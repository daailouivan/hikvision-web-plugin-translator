/**
 * Annke & Hikvision In-Page Bridge Hook
 * Virtualizes LocalServiceControl.exe (ports 33686-33695) directly in browser memory.
 * Emulates port detection, WebSocket protocol, window creation, and stream playback.
 */

(function () {
  if (window.__HIK_VIRTUAL_SERVICE_ACTIVE__) {
    console.log("[Annke/Hikvision Bridge] Bridge already active in this window.");
    return;
  }
  window.__HIK_VIRTUAL_SERVICE_ACTIVE__ = true;

  console.log("[Annke/Hikvision Bridge] Initializing in-page LocalService virtualization...");

  const LOCAL_PORTS_MIN = 33686;
  const LOCAL_PORTS_MAX = 33695;
  const VIRTUAL_PORT = 33686;
  const VIRTUAL_UUID = "c3b9e4a0-1234-4567-89ab-cdef01234567";
  const VIRTUAL_VERSION = "1.0.0.119";

  // Pre-seed sessionStorage so detectPort hits 33686 immediately
  try {
    sessionStorage.setItem("LocalServiceControlPort", String(VIRTUAL_PORT));
  } catch (e) {}

  // 1. Spoof navigator.platform to Win32 so getCreateWndMode and plugin.js accept browser environment
  try {
    Object.defineProperty(navigator, "platform", {
      get: () => "Win32",
      configurable: true
    });
  } catch (e) {
    console.warn("[Annke/Hikvision Bridge] Could not redefine navigator.platform:", e);
  }

  function isLocalServiceUrl(urlStr) {
    if (!urlStr || typeof urlStr !== "string") return false;
    try {
      if (urlStr.includes("127.0.0.1") || urlStr.includes("localhost")) {
        const url = new URL(urlStr, window.location.href);
        const port = parseInt(url.port, 10);
        if (port >= LOCAL_PORTS_MIN && port <= LOCAL_PORTS_MAX) return true;
        if (url.pathname.includes("/imghttp/")) return true;
      }
      return urlStr.includes("127.0.0.1:3368") || urlStr.includes("/imghttp/local");
    } catch (e) {
      return urlStr.includes("127.0.0.1:3368") || urlStr.includes("/imghttp/local");
    }
  }

  // =========================================================================
  // 2. Hook HTMLImageElement.src & setAttribute for Port Detection
  // =========================================================================
  // Camera SDK's detectPort uses `new Image(); n.src = "http://127.0.0.1:33686/imghttp/local?update=..."`
  const transparentPixel = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

  const origImgSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src") || {
    set(val) { this.setAttribute("src", val); },
    get() { return this.getAttribute("src"); }
  };

  Object.defineProperty(HTMLImageElement.prototype, "src", {
    set: function (url) {
      if (typeof url === "string" && isLocalServiceUrl(url)) {
        console.log("[Annke/Hikvision Bridge] Intercepted LocalService Image probe:", url);
        origImgSrcDescriptor.set.call(this, transparentPixel);
        setTimeout(() => {
          try {
            if (typeof this.onload === "function") {
              this.onload(new Event("load"));
            }
            this.dispatchEvent(new Event("load"));
          } catch (e) {
            console.error("[Annke/Hikvision Bridge] Error in Image onload dispatcher:", e);
          }
        }, 5);
        return;
      }
      return origImgSrcDescriptor.set.call(this, url);
    },
    get: function () {
      return origImgSrcDescriptor.get.call(this);
    },
    configurable: true,
    enumerable: true
  });

  const origSetAttribute = HTMLImageElement.prototype.setAttribute;
  HTMLImageElement.prototype.setAttribute = function (name, value) {
    if (name && name.toLowerCase() === "src" && typeof value === "string" && isLocalServiceUrl(value)) {
      this.src = value;
      return;
    }
    return origSetAttribute.apply(this, arguments);
  };

  // =========================================================================
  // 3. Hook JSVideoPlugin on window if defined/assigned
  // =========================================================================
  function patchJSVideoPlugin(pluginClass) {
    if (!pluginClass) return;
    try {
      if (typeof pluginClass.getPluginMode === "function") {
        pluginClass.getPluginMode = function () {
          console.log("[Annke/Hikvision Bridge] JSVideoPlugin.getPluginMode invoked -> returning LocalService mode (2)");
          return Promise.resolve(2);
        };
      }
      if (pluginClass.prototype && typeof pluginClass.prototype.JS_CheckLocalServiceConnected === "function") {
        pluginClass.prototype.JS_CheckLocalServiceConnected = function () {
          console.log("[Annke/Hikvision Bridge] JS_CheckLocalServiceConnected invoked -> resolving");
          return Promise.resolve();
        };
      }
    } catch (e) {
      console.warn("[Annke/Hikvision Bridge] Failed to patch JSVideoPlugin:", e);
    }
  }

  let _capturedPlugin = window.JSVideoPlugin;
  if (_capturedPlugin) {
    patchJSVideoPlugin(_capturedPlugin);
  }
  Object.defineProperty(window, "JSVideoPlugin", {
    get: () => _capturedPlugin,
    set: (val) => {
      _capturedPlugin = val;
      patchJSVideoPlugin(_capturedPlugin);
    },
    configurable: true,
    enumerable: true
  });

  // =========================================================================
  // 4. Virtual Canvas & Multi-Window Grid Management
  // =========================================================================
  let activeVirtualWebSocket = null;

  const WindowManager = {
    cells: new Map(),
    splitMode: 1, // 1: 1x1, 2: 2x2, 3: 3x3, 4: 4x4
    selectedWndIndex: 0,
    maximizedWndIndex: -1,

    getContainer() {
      const candidates = [
        document.getElementById("main_plugin"),
        document.getElementById("divPlugin"),
        document.getElementById("play_window"),
        document.getElementById("liveview_play"),
        document.querySelector(".plugin-content"),
        document.querySelector(".video-content"),
        document.getElementById("view"),
        document.body
      ];
      const container = candidates.find(el => el !== null && el !== undefined) || document.body;
      if (container && container !== document.body) {
        container.style.position = "relative";
        container.style.backgroundColor = "#121212";
        container.style.overflow = "hidden";
        const tip = container.querySelector(".txtTip, .pluginLink, table");
        if (tip) tip.remove();
      }
      return container;
    },

    resolveChannelName(channelId) {
      if (!channelId) return "";
      try {
        const chNum = Math.floor(parseInt(channelId, 10) / 100);
        const chNameEl = document.querySelector(`.channel-list .ch-name[channel='${chNum}']`) ||
                         document.querySelector(`.channel-list [channel='${chNum}']`) ||
                         document.querySelector(`.ch-name[channel='${channelId}']`);
        if (chNameEl && chNameEl.textContent.trim()) {
          return `${chNameEl.textContent.trim()} [CH ${chNum}]`;
        }
        if (chNum > 0) return `Camera ${chNum}`;
      } catch (e) {}
      return `CH ${channelId}`;
    },

    getCell(wndIndex = 0) {
      wndIndex = parseInt(wndIndex, 10) || 0;
      if (this.cells.has(wndIndex)) {
        return this.cells.get(wndIndex);
      }

      const container = this.getContainer();
      const cellId = `hik-wnd-cell-${wndIndex}`;
      let cellEl = document.getElementById(cellId);
      let canvas = null;
      let osdEl = null;
      let osdTitle = null;
      let osdBadge = null;
      let osdRes = null;

      if (!cellEl) {
        cellEl = document.createElement("div");
        cellEl.id = cellId;
        cellEl.className = "hik-wnd-cell";
        cellEl.setAttribute("data-wnd-index", String(wndIndex));

        canvas = document.createElement("canvas");
        canvas.id = `hik-virtual-canvas-${wndIndex}`;
        canvas.className = "hik-wnd-canvas";
        cellEl.appendChild(canvas);

        // Idle placeholder
        const placeholder = document.createElement("div");
        placeholder.className = "hik-wnd-placeholder";
        placeholder.innerHTML = `
          <div class="hik-ph-icon">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M4 6h11a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z"/>
            </svg>
          </div>
          <div class="hik-ph-title">Window ${wndIndex + 1}</div>
          <div class="hik-ph-sub">Click camera in left panel</div>
        `;
        cellEl.appendChild(placeholder);

        // OSD bar
        osdEl = document.createElement("div");
        osdEl.className = "hik-wnd-osd";

        osdBadge = document.createElement("span");
        osdBadge.className = "hik-wnd-badge";
        osdEl.appendChild(osdBadge);

        osdTitle = document.createElement("span");
        osdTitle.className = "hik-wnd-title";
        osdTitle.textContent = `Window ${wndIndex + 1}`;
        osdEl.appendChild(osdTitle);

        osdRes = document.createElement("span");
        osdRes.className = "hik-wnd-res";
        osdEl.appendChild(osdRes);

        cellEl.appendChild(osdEl);

        // Quick action buttons overlay (visible on hover)
        const actionsBar = document.createElement("div");
        actionsBar.className = "hik-wnd-actions";
        actionsBar.innerHTML = `
          <button class="hik-act-btn" title="Snapshot" data-act="snap">📷</button>
          <button class="hik-act-btn" title="Toggle Full / Grid" data-act="zoom">⛶</button>
          <button class="hik-act-btn hik-act-close" title="Close Camera Stream" data-act="stop">✕</button>
        `;
        cellEl.appendChild(actionsBar);

        actionsBar.addEventListener("click", (e) => {
          e.stopPropagation();
          const target = e.target.closest("button");
          if (!target) return;
          const act = target.getAttribute("data-act");
          if (act === "snap") {
            const entry = this.cells.get(wndIndex);
            if (entry && entry.player) {
              entry.player.downloadSnapshot(`camera_ch${entry.channelId || (wndIndex + 1)}_${Date.now()}.jpg`);
            }
          } else if (act === "zoom") {
            this.toggleMaximize(wndIndex);
          } else if (act === "stop") {
            this.stop(wndIndex);
          }
        });

        // Click to select window
        cellEl.addEventListener("click", (e) => {
          e.stopPropagation();
          this.selectWindow(wndIndex);
        });

        // Double click to toggle maximize / restore
        cellEl.addEventListener("dblclick", (e) => {
          e.stopPropagation();
          this.toggleMaximize(wndIndex);
        });

        container.appendChild(cellEl);
      } else {
        canvas = cellEl.querySelector("canvas");
        osdTitle = cellEl.querySelector(".hik-wnd-title");
        osdBadge = cellEl.querySelector(".hik-wnd-badge");
        osdRes = cellEl.querySelector(".hik-wnd-res");
      }

      const player = new CameraStreamPlayer(canvas);
      const entry = {
        wndIndex,
        cellEl,
        canvas,
        osdTitle,
        osdBadge,
        osdRes,
        player,
        isPlaying: false,
        channelId: null
      };

      player.onStats = (stats) => {
        if (entry.osdRes && entry.isPlaying) {
          entry.osdRes.textContent = `${stats.width}x${stats.height}${stats.fps ? ` • ${stats.fps}fps` : ""}`;
        }
      };

      this.cells.set(wndIndex, entry);
      return entry;
    },

    selectWindow(wndIndex) {
      wndIndex = parseInt(wndIndex, 10) || 0;
      this.selectedWndIndex = wndIndex;
      console.log(`[Annke/Hikvision Bridge] Selected window: ${wndIndex}`);

      this.cells.forEach((entry, idx) => {
        if (idx === wndIndex) {
          entry.cellEl.classList.add("hik-wnd-selected");
        } else {
          entry.cellEl.classList.remove("hik-wnd-selected");
        }
      });

      if (activeVirtualWebSocket) {
        activeVirtualWebSocket.dispatchVirtualCmd({
          cmd: "window.onGetSelectWndInfo",
          wndInfo: { wndIndex: wndIndex }
        });
      }
    },

    toggleMaximize(wndIndex) {
      wndIndex = parseInt(wndIndex, 10) || 0;
      if (this.maximizedWndIndex === wndIndex) {
        console.log(`[Annke/Hikvision Bridge] Restoring grid layout from window ${wndIndex}`);
        this.maximizedWndIndex = -1;
      } else {
        console.log(`[Annke/Hikvision Bridge] Maximizing window ${wndIndex}`);
        this.maximizedWndIndex = wndIndex;
      }
      this.updateLayout();
      this.selectWindow(wndIndex);
    },

    arrangeWindow(split) {
      split = parseInt(split, 10);
      if (isNaN(split) || split < 1) split = 1;
      if (split === 9) split = 3;
      else if (split === 16) split = 4;
      else if (split > 4) split = 4;
      console.log(`[Annke/Hikvision Bridge] Arranging window grid to ${split}x${split} (${split * split} windows)`);
      this.splitMode = split;
      this.maximizedWndIndex = -1;

      const totalSlots = split * split;
      for (let i = 0; i < totalSlots; i++) {
        this.getCell(i);
      }

      this.updateLayout();

      if (this.selectedWndIndex >= totalSlots) {
        this.selectWindow(0);
      } else {
        this.selectWindow(this.selectedWndIndex);
      }
    },

    updateLayout() {
      const split = this.splitMode;
      const totalSlots = split * split;

      if (this.maximizedWndIndex >= 0) {
        this.cells.forEach((entry, idx) => {
          if (idx === this.maximizedWndIndex) {
            entry.cellEl.style.display = "block";
            entry.cellEl.style.left = "0%";
            entry.cellEl.style.top = "0%";
            entry.cellEl.style.width = "100%";
            entry.cellEl.style.height = "100%";
            entry.cellEl.style.zIndex = "40";
          } else {
            entry.cellEl.style.display = "none";
          }
        });
        return;
      }

      for (let i = 0; i < totalSlots; i++) {
        const entry = this.getCell(i);
        const col = i % split;
        const row = Math.floor(i / split);

        entry.cellEl.style.display = "block";
        entry.cellEl.style.left = `${(col * 100 / split).toFixed(3)}%`;
        entry.cellEl.style.top = `${(row * 100 / split).toFixed(3)}%`;
        entry.cellEl.style.width = `${(100 / split).toFixed(3)}%`;
        entry.cellEl.style.height = `${(100 / split).toFixed(3)}%`;
        entry.cellEl.style.zIndex = (i === this.selectedWndIndex) ? "25" : "15";
      }

      this.cells.forEach((entry, idx) => {
        if (idx >= totalSlots) {
          entry.cellEl.style.display = "none";
          if (entry.isPlaying) {
            console.log(`[Annke/Hikvision Bridge] Stopping hidden window ${idx} on grid resize`);
            entry.player.stop();
            entry.isPlaying = false;
            entry.cellEl.classList.remove("playing");
            if (entry.osdBadge) entry.osdBadge.classList.remove("live");
            if (entry.osdRes) entry.osdRes.textContent = "";
          }
        }
      });
    },

    startPlay(wndIndex, streamUrl, options, channelId) {
      wndIndex = parseInt(wndIndex, 10) || 0;
      const entry = this.getCell(wndIndex);
      entry.isPlaying = true;
      entry.channelId = channelId;
      entry.cellEl.classList.add("playing");

      const chLabel = this.resolveChannelName(channelId);
      if (entry.osdTitle) entry.osdTitle.textContent = chLabel;
      if (entry.osdBadge) entry.osdBadge.classList.add("live");

      entry.player.play(streamUrl, options);
      this.selectWindow(wndIndex);
    },

    stop(wndIndex) {
      wndIndex = parseInt(wndIndex, 10) || 0;
      const entry = this.cells.get(wndIndex);
      if (entry) {
        entry.isPlaying = false;
        entry.cellEl.classList.remove("playing");
        entry.player.stop();
        if (entry.osdTitle) entry.osdTitle.textContent = `Window ${wndIndex + 1}`;
        if (entry.osdBadge) entry.osdBadge.classList.remove("live");
        if (entry.osdRes) entry.osdRes.textContent = "";
      }
    },

    stopAll() {
      console.log("[Annke/Hikvision Bridge] Stopping all active camera windows.");
      this.cells.forEach((entry, idx) => {
        this.stop(idx);
      });
    },

    toggleFullscreen() {
      const container = this.getContainer();
      if (!document.fullscreenElement) {
        container.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // Observer to immediately remove any "click to download plugin" injected into #main_plugin
  function setupPluginCleaner() {
    const observer = new MutationObserver(() => {
      const mainPlugin = document.getElementById("main_plugin");
      if (mainPlugin) {
        const prompt = mainPlugin.querySelector(".txtTip, .pluginLink, table");
        if (prompt) {
          console.log("[Annke/Hikvision Bridge] DOM observer: Suppressing download prompt table");
          prompt.remove();
        }
      }
    });

    const targetNode = document.documentElement || document.body;
    if (targetNode) {
      observer.observe(targetNode, { childList: true, subtree: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupPluginCleaner);
  } else {
    setupPluginCleaner();
  }

  // =========================================================================
  // 5. Virtual WebSocket Emulation
  // =========================================================================
  const NativeWebSocket = window.WebSocket;

  class VirtualLocalServiceWebSocket extends EventTarget {
    constructor(url, protocols) {
      super();
      this.url = url;
      this.protocols = protocols;
      this.readyState = WebSocket.CONNECTING;
      this.onopen = null;
      this.onclose = null;
      this.onmessage = null;
      this.onerror = null;

      activeVirtualWebSocket = this;
      console.log(`[Annke/Hikvision Bridge] Intercepted WebSocket connection to: ${url}`);

      // Emulate rapid connection open
      setTimeout(() => {
        this.readyState = WebSocket.OPEN;
        const openEvent = new Event("open");
        if (typeof this.onopen === "function") this.onopen(openEvent);
        this.dispatchEvent(openEvent);
      }, 10);
    }

    dispatchVirtualCmd(cmdObj) {
      if (this.readyState === WebSocket.OPEN) {
        const msgEvent = new MessageEvent("message", { data: JSON.stringify(cmdObj) });
        if (typeof this.onmessage === "function") this.onmessage(msgEvent);
        this.dispatchEvent(msgEvent);
      }
    }

    send(data) {
      let msg = null;
      try {
        msg = typeof data === "string" ? JSON.parse(data) : data;
      } catch (e) {
        console.warn("[Annke/Hikvision Bridge] Non-JSON WebSocket payload:", data);
        return;
      }

      const cmd = msg.cmd || msg.action || "";
      const sequence = msg.sequence || "";
      console.log(`[Annke/Hikvision Bridge] WebSocket Command: "${cmd}", seq: "${sequence}"`, msg);

      // CRITICAL: Handshake command system.webconnect
      if (cmd === "system.webconnect") {
        setTimeout(() => {
          if (this.readyState === WebSocket.OPEN) {
            const handshakeResp = {
              uuid: VIRTUAL_UUID,
              version: VIRTUAL_VERSION,
              errorCode: 0
            };
            const msgEvent = new MessageEvent("message", { data: JSON.stringify(handshakeResp) });
            if (typeof this.onmessage === "function") this.onmessage(msgEvent);
            this.dispatchEvent(msgEvent);
            console.log("[Annke/Hikvision Bridge] Dispatched system.webconnect success handshake");
          }
        }, 5);
        return;
      }

      let response = {
        sequence: sequence,
        errorCode: 0,
        errorModule: 0,
        data: {}
      };

      const wndIndex = msg.wndIndex || 0;

      switch (cmd) {
        case "window.createWnd":
        case "createWnd": {
          WindowManager.arrangeWindow(WindowManager.splitMode);
          response.wndIndex = WindowManager.selectedWndIndex;
          break;
        }

        case "window.setWndGeometry":
        case "setWndGeometry": {
          WindowManager.updateLayout();
          break;
        }

        case "window.setWndCover":
        case "setWndCover":
        case "window.setWndZOrder":
        case "window.updateParentWnd": {
          break;
        }

        case "video.arrangeWindow":
        case "arrangeWindow": {
          const splitType = msg.type || msg.split || 1;
          WindowManager.arrangeWindow(splitType);
          break;
        }

        case "window.showWnd":
        case "showWnd": {
          const entry = WindowManager.getCell(wndIndex);
          if (entry && entry.cellEl) entry.cellEl.style.display = "block";
          break;
        }

        case "window.hideWnd":
        case "hideWnd": {
          const entry = WindowManager.getCell(wndIndex);
          if (entry && entry.cellEl) entry.cellEl.style.display = "none";
          break;
        }

        case "window.getLocalServiceVersion":
        case "getLocalServiceVersion": {
          response.localServiceVersion = VIRTUAL_VERSION;
          response.version = VIRTUAL_VERSION;
          break;
        }

        case "video.getLocalConfig":
        case "getLocalConfig": {
          response.localConfig = {
            protocolType: "0",
            streamType: "0",
            realPlayAll: "0", // CRITICAL: 0 stops auto-playing all channels on startup
            captureFileFormat: "0",
            capturePath: "Downloads",
            recordPath: "Downloads",
            playbackPath: "Downloads",
            secretKey: ""
          };
          break;
        }

        case "video.setLocalConfig":
        case "setLocalConfig":
        case "video.setPlayMode":
        case "setPlayMode":
        case "video.setIsHttps":
        case "video.setSecretKey":
        case "setSecretKey": {
          break;
        }

        case "video.getDecryptString":
        case "getDecryptString": {
          response.decryptString = msg.key || "";
          break;
        }

        case "video.startPlay":
        case "startPlay":
        case "startPlayV2": {
          let streamUrl = msg.url || "";
          const loc = window.location;
          const cameraOrigin = `${loc.protocol}//${loc.host}`;

          // Normalize channel ID:
          // Handles PSIA 3301 -> ISAPI 101, 3401 -> 201, etc.
          // Handles video://.../101 -> 101, channel: 1 -> 101
          function normalizeChannel(raw) {
            let c = parseInt(raw, 10);
            if (isNaN(c) || c <= 0) return "101";
            if (c >= 3300) {
              c = (Math.floor(c / 100) - 32) * 100 + (c % 100);
            } else if (c < 100) {
              c = c * 100 + 1;
            }
            return String(c);
          }

          let channelId = "101";
          if (msg.channel) {
            channelId = normalizeChannel(msg.channel);
          } else if (typeof streamUrl === "string") {
            const m = streamUrl.match(/\/(\d{3,4})(?:\/|$|\?)/) || streamUrl.match(/(\d{3,4})/);
            if (m) channelId = normalizeChannel(m[1]);
          }

          console.log(`[Annke/Hikvision Bridge] Starting stream playback for wndIndex ${wndIndex}, channel: ${channelId}, rawUrl: ${streamUrl}`);
          WindowManager.startPlay(wndIndex, streamUrl, {
            channel: channelId,
            origin: cameraOrigin,
            auth: msg.auth,
            token: msg.token,
            userInfo: msg.userInfo
          }, channelId);
          break;
        }

        case "video.stop":
        case "stop": {
          WindowManager.stop(wndIndex);
          break;
        }

        case "video.stopAll":
        case "stopAll": {
          WindowManager.stopAll();
          break;
        }

        case "video.pause":
        case "pause": {
          WindowManager.stop(wndIndex);
          break;
        }

        case "video.capture":
        case "capture": {
          const entry = WindowManager.cells.get(wndIndex);
          if (entry && entry.player) {
            entry.player.downloadSnapshot(`camera_snap_${Date.now()}.jpg`);
          }
          break;
        }

        case "video.fullScreen":
        case "fullScreen": {
          WindowManager.toggleFullscreen();
          break;
        }

        case "video.startSave":
        case "startSave": {
          const entry = WindowManager.cells.get(wndIndex);
          if (entry && entry.player) entry.player.startRecording();
          break;
        }

        case "video.stopSave":
        case "stopSave": {
          const entry = WindowManager.cells.get(wndIndex);
          if (entry && entry.player) entry.player.stopRecording();
          break;
        }

        case "video.getOSDTime":
        case "getOSDTime": {
          response.osdTime = Math.floor(Date.now() / 1000);
          break;
        }

        case "video.getPlayInfo":
        case "getPlayInfo": {
          response.playInfo = {
            pictureSize: { width: 704, height: 576 },
            width: 704,
            height: 576,
            fps: 25
          };
          break;
        }

        case "video.openSound":
        case "openSound":
        case "video.closeSound":
        case "closeSound": {
          break;
        }

        case "video.getVolume":
        case "getVolume": {
          response.volume = 50;
          break;
        }

        case "video.setVolume":
        case "setVolume": {
          break;
        }

        case "video.resume":
        case "resume":
        case "video.seek":
        case "video.slow":
        case "video.fast":
        case "video.frame":
        case "video.reversePlay":
        case "video.setPlayBackType":
        case "video.setPlaybackDrawType":
        case "video.setTrsPlayBackParam": {
          break;
        }

        case "video.getRectInfo":
        case "getRectInfo": {
          response.rectInfo = [];
          break;
        }

        case "video.setRectInfo":
        case "setRectInfo": {
          break;
        }

        case "video.getPolygonInfo":
        case "getPolygonInfo": {
          response.polygonInfo = [];
          break;
        }

        case "video.setPolygonInfo":
        case "setPolygonInfo": {
          break;
        }

        case "video.getLineInfo":
        case "getLineInfo": {
          response.lineInfo = [];
          break;
        }

        case "video.setLineInfo":
        case "setLineInfo": {
          break;
        }

        case "video.getPointInfo":
        case "getPointInfo": {
          response.pointInfo = [];
          break;
        }

        case "video.setPointInfo":
        case "setPointInfo": {
          break;
        }

        case "video.getGridInfo":
        case "getGridInfo": {
          response.gridInfo = [];
          break;
        }

        case "video.setGridInfo":
        case "setGridInfo": {
          break;
        }

        case "video.getTextOverlay":
        case "getTextOverlay": {
          response.overlayInfo = [];
          response.textOverlay = [];
          break;
        }

        case "video.setTextOverlay":
        case "setTextOverlay":
        case "video.clearRegion":
        case "video.clearShapeByType":
        case "video.chooseShape":
        case "video.setDrawStatus":
        case "video.setDrawCallback":
        case "video.setDrawShapeInfo":
        case "video.setWndResolution":
        case "video.setWndRatioMode":
        case "video.enableZoom":
        case "video.disableZoom":
        case "video.enableIVS":
        case "video.enablePDC":
        case "video.startTalk":
        case "video.stopTalk": {
          break;
        }

        case "video.getLastError":
        case "getLastError": {
          response.error = 0;
          break;
        }

        case "video.browseFilePath":
        case "video.openDirectory": {
          response.path = "Downloads";
          break;
        }

        case "video.startAsyncDownload": {
          response.downloadId = 1;
          break;
        }

        case "video.stopAsyncDownload": {
          break;
        }

        case "video.getDownloadStatus":
        case "video.getDownloadProgress":
        case "video.getUpgradeStatus":
        case "video.getUpgradeProgress": {
          response.status = 100;
          response.progress = 100;
          break;
        }

        case "video.startUpgrade":
        case "video.stopUpgrade":
        case "video.exportDeviceLog":
        case "video.exportReport": {
          break;
        }

        case "detectport": {
          response.data = {
            port: VIRTUAL_PORT,
            status: "success",
            bClientUsed: false
          };
          break;
        }

        default:
          response.data = { status: "ok" };
          break;
      }

      // Respond asynchronously to satisfy sendRequest promise
      setTimeout(() => {
        if (this.readyState === WebSocket.OPEN) {
          const responseStr = JSON.stringify(response);
          const msgEvent = new MessageEvent("message", { data: responseStr });
          if (typeof this.onmessage === "function") this.onmessage(msgEvent);
          this.dispatchEvent(msgEvent);
        }
      }, 5);
    }

    close(code, reason) {
      if (activeVirtualWebSocket === this) activeVirtualWebSocket = null;
      this.readyState = WebSocket.CLOSED;
      const closeEvent = new CloseEvent("close", { code: code || 1000, reason: reason || "" });
      if (typeof this.onclose === "function") this.onclose(closeEvent);
      this.dispatchEvent(closeEvent);
    }
  }

  // Hook WebSocket constructor
  window.WebSocket = function (url, protocols) {
    if (isLocalServiceUrl(url)) {
      return new VirtualLocalServiceWebSocket(url, protocols);
    }
    return new NativeWebSocket(url, protocols);
  };
  window.WebSocket.prototype = NativeWebSocket.prototype;
  window.WebSocket.CONNECTING = 0;
  window.WebSocket.OPEN = 1;
  window.WebSocket.CLOSING = 2;
  window.WebSocket.CLOSED = 3;

  // =========================================================================
  // 6. Virtual Fetch / XMLHttpRequest Emulation for HTTP Fallback
  // =========================================================================
  const nativeFetch = window.fetch;
  window.fetch = async function (resource, init) {
    const urlStr = typeof resource === "string" ? resource : (resource && resource.url) || "";
    if (isLocalServiceUrl(urlStr)) {
      console.log(`[Annke/Hikvision Bridge] Intercepted HTTP fetch to: ${urlStr}`);
      const mockPayload = {
        errorCode: 0,
        errorModule: 0,
        localServiceVersion: VIRTUAL_VERSION,
        data: { port: VIRTUAL_PORT, status: "success" }
      };
      return new Response(JSON.stringify(mockPayload), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cross-Origin-Resource-Policy": "cross-origin"
        }
      });
    }
    return nativeFetch.apply(this, arguments);
  };

  const NativeXHR = window.XMLHttpRequest;
  function VirtualXHR() {
    const xhr = new NativeXHR();
    let isIntercepted = false;
    let targetUrl = "";

    const originalOpen = xhr.open;
    xhr.open = function (method, url) {
      targetUrl = url;
      if (isLocalServiceUrl(url)) {
        isIntercepted = true;
      }
      return originalOpen.apply(this, arguments);
    };

    const originalSend = xhr.send;
    xhr.send = function (body) {
      if (isIntercepted) {
        console.log(`[Annke/Hikvision Bridge] Intercepted XHR send to: ${targetUrl}`);
        setTimeout(() => {
          Object.defineProperty(xhr, "readyState", { value: 4, writable: false });
          Object.defineProperty(xhr, "status", { value: 200, writable: false });
          Object.defineProperty(xhr, "statusText", { value: "OK", writable: false });
          Object.defineProperty(xhr, "responseText", {
            value: JSON.stringify({
              errorCode: 0,
              errorModule: 0,
              localServiceVersion: VIRTUAL_VERSION,
              data: { port: VIRTUAL_PORT, status: "success" }
            }),
            writable: false
          });
          xhr.dispatchEvent(new Event("readystatechange"));
          xhr.dispatchEvent(new Event("load"));
        }, 10);
        return;
      }
      return originalSend.apply(this, arguments);
    };

    return xhr;
  }
  window.XMLHttpRequest = VirtualXHR;

  // =========================================================================
  // 7. Inject Default Canvas Styling
  // =========================================================================
  function injectCanvasStyle() {
    if (document.getElementById("hik-bridge-canvas-style")) return;
    const style = document.createElement("style");
    style.id = "hik-bridge-canvas-style";
    style.textContent = `
      #main_plugin {
        position: relative !important;
        background: #121212 !important;
        min-height: 240px;
        width: 100% !important;
        height: 100% !important;
        overflow: hidden !important;
      }
      #main_plugin table {
        display: none !important;
      }
      .hik-wnd-cell {
        position: absolute !important;
        box-sizing: border-box !important;
        border: 1px solid #282828 !important;
        background: #000 !important;
        overflow: hidden !important;
        cursor: pointer;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }
      .hik-wnd-cell.hik-wnd-selected {
        border: 2px solid #2196F3 !important;
        box-shadow: inset 0 0 6px rgba(33, 150, 243, 0.5) !important;
      }
      .hik-wnd-cell:hover:not(.hik-wnd-selected) {
        border-color: #555 !important;
      }
      .hik-wnd-canvas {
        position: absolute !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        display: block !important;
        background: #000 !important;
        object-fit: contain !important;
      }
      .hik-wnd-osd {
        position: absolute;
        top: 6px;
        left: 6px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: 11px;
        font-weight: 500;
        color: #f0f0f0;
        background: rgba(18, 18, 18, 0.75);
        backdrop-filter: blur(2px);
        padding: 3px 8px;
        border-radius: 4px;
        pointer-events: none;
        z-index: 30;
        user-select: none;
        display: flex;
        align-items: center;
        gap: 6px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.5);
      }
      .hik-wnd-badge {
        display: inline-block;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #757575;
      }
      .hik-wnd-badge.live {
        background: #00e676;
        box-shadow: 0 0 6px #00e676;
      }
      .hik-wnd-res {
        color: #aaa;
        font-size: 10px;
        margin-left: 2px;
      }
      .hik-wnd-cell.playing .hik-wnd-placeholder {
        display: none !important;
      }
      .hik-wnd-placeholder {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: radial-gradient(circle at center, #181818 0%, #0d0d0d 100%);
        pointer-events: none;
        user-select: none;
        z-index: 5;
      }
      .hik-ph-icon {
        color: #444;
        margin-bottom: 6px;
      }
      .hik-ph-title {
        color: #777;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        font-weight: 500;
        letter-spacing: 0.5px;
      }
      .hik-ph-sub {
        color: #4a4a4a;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 11px;
        margin-top: 3px;
      }
      .hik-wnd-actions {
        position: absolute;
        top: 6px;
        right: 6px;
        display: flex;
        gap: 4px;
        z-index: 35;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      .hik-wnd-cell:hover .hik-wnd-actions {
        opacity: 1;
      }
      .hik-act-btn {
        background: rgba(28, 28, 28, 0.85);
        color: #eee;
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 11px;
        line-height: 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(4px);
        transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
      }
      .hik-act-btn:hover {
        background: #2196F3;
        border-color: #2196F3;
        color: #fff;
        transform: scale(1.05);
      }
      .hik-act-btn.hik-act-close:hover {
        background: #f44336;
        border-color: #f44336;
        color: #fff;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  // Synchronize fullscreen state with Hikvision UI toolbar
  document.addEventListener("fullscreenchange", () => {
    const isFull = !!document.fullscreenElement;
    if (activeVirtualWebSocket) {
      activeVirtualWebSocket.dispatchVirtualCmd({
        cmd: "window.onFullScreenChange",
        full: isFull
      });
    }
  });

  if (document.head || document.documentElement) {
    injectCanvasStyle();
  } else {
    document.addEventListener("DOMContentLoaded", injectCanvasStyle);
  }

  console.log("[Annke/Hikvision Bridge] LocalService virtualization initialized successfully.");
})();
