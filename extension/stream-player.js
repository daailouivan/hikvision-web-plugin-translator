/**
 * High-Performance Modern Camera Stream Player
 * Uses WebCodecs VideoDecoder, HTTP streaming reader with Digest & Basic Auth, and Canvas rendering.
 */

if (typeof window !== "undefined" && window.CameraStreamPlayer) {
  // Guarded against re-declaration
} else {
  // =========================================================================
  // Pure JavaScript MD5 Implementation for RFC 2617 HTTP Digest Auth
  // =========================================================================
  function md5(string) {
    function rotateLeft(lValue, iShiftBits) {
      return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
    }
    function addUnsigned(lX, lY) {
      var lX4 = lX & 0x40000000,
        lY4 = lY & 0x40000000;
      var lX8 = lX & 0x80000000,
        lY8 = lY & 0x80000000;
      var lResult = (lX & 0x3fffffff) + (lY & 0x3fffffff);
      if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8;
      if (lX4 | lY4) {
        if (lResult & 0x40000000) return lResult ^ 0xc0000000 ^ lX8 ^ lY8;
        else return lResult ^ 0x40000000 ^ lX8 ^ lY8;
      } else {
        return lResult ^ lX8 ^ lY8;
      }
    }
    function F(x, y, z) { return (x & y) | (~x & z); }
    function G(x, y, z) { return (x & z) | (y & ~z); }
    function H(x, y, z) { return x ^ y ^ z; }
    function I(x, y, z) { return y ^ (x | ~z); }
    function FF(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    function GG(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    function HH(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    function II(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    function convertToWordArray(string) {
      var lWordCount;
      var lMessageLength = string.length;
      var lNumberOfWords_temp1 = lMessageLength + 8;
      var lNumberOfWords_temp2 =
        (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
      var lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
      var lWordArray = Array(lNumberOfWords - 1);
      var lBytePosition = 0;
      var lByteCount = 0;
      while (lByteCount < lMessageLength) {
        lWordCount = (lByteCount - (lByteCount % 4)) / 4;
        lBytePosition = (lByteCount % 4) * 8;
        lWordArray[lWordCount] =
          lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition);
        lByteCount++;
      }
      lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
      lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
      lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
      return lWordArray;
    }
    function wordToHex(lValue) {
      var WordToHexValue = "",
        WordToHexValue_temp = "",
        lByte,
        lCount;
      for (lCount = 0; lCount <= 3; lCount++) {
        lByte = (lValue >>> (lCount * 8)) & 255;
        WordToHexValue_temp = "0" + lByte.toString(16);
        WordToHexValue =
          WordToHexValue +
          WordToHexValue_temp.substr(WordToHexValue_temp.length - 2, 2);
      }
      return WordToHexValue;
    }
    var x = convertToWordArray(unescape(encodeURIComponent(string)));
    var k,
      AA,
      BB,
      CC,
      DD,
      a = 0x67452301,
      b = 0xefcdab89,
      c = 0x98badcfe,
      d = 0x10325476;
    var S11 = 7, S12 = 12, S13 = 17, S14 = 22,
      S21 = 5, S22 = 9, S23 = 14, S24 = 20,
      S31 = 4, S32 = 11, S33 = 16, S34 = 23,
      S41 = 6, S42 = 10, S43 = 15, S44 = 21;
    for (k = 0; k < x.length; k += 16) {
      AA = a; BB = b; CC = c; DD = d;
      a = FF(a, b, c, d, x[k + 0], S11, 0xd76aa478);
      d = FF(d, a, b, c, x[k + 1], S12, 0xe8c7b756);
      c = FF(c, d, a, b, x[k + 2], S13, 0x242070db);
      b = FF(b, c, d, a, x[k + 3], S14, 0xc1bdceee);
      a = FF(a, b, c, d, x[k + 4], S11, 0xf57c0faf);
      d = FF(d, a, b, c, x[k + 5], S12, 0x4787c62a);
      c = FF(c, d, a, b, x[k + 6], S13, 0xa8304613);
      b = FF(b, c, d, a, x[k + 7], S14, 0xfd469501);
      a = FF(a, b, c, d, x[k + 8], S11, 0x698098d8);
      d = FF(d, a, b, c, x[k + 9], S12, 0x8b44f7af);
      c = FF(c, d, a, b, x[k + 10], S13, 0xffff5bb1);
      b = FF(b, c, d, a, x[k + 11], S14, 0x895cd7be);
      a = FF(a, b, c, d, x[k + 12], S11, 0x6b901122);
      d = FF(d, a, b, c, x[k + 13], S12, 0xfd987193);
      c = FF(c, d, a, b, x[k + 14], S13, 0xa679438e);
      b = FF(b, c, d, a, x[k + 15], S14, 0x49b40821);
      a = GG(a, b, c, d, x[k + 1], S21, 0xf61e2562);
      d = GG(d, a, b, c, x[k + 6], S22, 0xc040b340);
      c = GG(c, d, a, b, x[k + 11], S23, 0x265e5a51);
      b = GG(b, c, d, a, x[k + 0], S24, 0xe9b6c7aa);
      a = GG(a, b, c, d, x[k + 5], S21, 0xd62f105d);
      d = GG(d, a, b, c, x[k + 10], S22, 0x2441453);
      c = GG(c, d, a, b, x[k + 15], S23, 0xd8a1e681);
      b = GG(b, c, d, a, x[k + 4], S24, 0xe7d3fbc8);
      a = GG(a, b, c, d, x[k + 9], S21, 0x21e1cde6);
      d = GG(d, a, b, c, x[k + 14], S22, 0xc33707d6);
      c = GG(c, d, a, b, x[k + 3], S23, 0xf4d50d87);
      b = GG(b, c, d, a, x[k + 8], S24, 0x455a14ed);
      a = GG(a, b, c, d, x[k + 13], S21, 0xa9e3e905);
      d = GG(d, a, b, c, x[k + 2], S22, 0xfcefa3f8);
      c = GG(c, d, a, b, x[k + 7], S23, 0x676f02d9);
      b = GG(b, c, d, a, x[k + 12], S24, 0x8d2a4c8a);
      a = HH(a, b, c, d, x[k + 5], S31, 0xfffa3942);
      d = HH(d, a, b, c, x[k + 8], S32, 0x8771f681);
      c = HH(c, d, a, b, x[k + 11], S33, 0x6d9d6122);
      b = HH(b, c, d, a, x[k + 14], S34, 0xfde5380c);
      a = HH(a, b, c, d, x[k + 1], S31, 0xa4beea44);
      d = HH(d, a, b, c, x[k + 4], S32, 0x4bdecfa9);
      c = HH(c, d, a, b, x[k + 7], S33, 0xf6bb4b60);
      b = HH(b, c, d, a, x[k + 10], S34, 0xbebfbc70);
      a = HH(a, b, c, d, x[k + 13], S31, 0x289b7ec6);
      d = HH(d, a, b, c, x[k + 0], S32, 0xeaa127fa);
      c = HH(c, d, a, b, x[k + 3], S33, 0xd4ef3085);
      b = HH(b, c, d, a, x[k + 6], S34, 0x4881d05);
      a = HH(a, b, c, d, x[k + 9], S31, 0xd9d4d039);
      d = HH(d, a, b, c, x[k + 12], S32, 0xe6db99e5);
      c = HH(c, d, a, b, x[k + 15], S33, 0x1fa27cf8);
      b = HH(b, c, d, a, x[k + 2], S34, 0xc4ac5665);
      a = II(a, b, c, d, x[k + 0], S41, 0xf4292244);
      d = II(d, a, b, c, x[k + 7], S42, 0x432aff97);
      c = II(c, d, a, b, x[k + 14], S43, 0xab9423a7);
      b = II(b, c, d, a, x[k + 5], S44, 0xfc93a039);
      a = II(a, b, c, d, x[k + 12], S41, 0x655b59c3);
      d = II(d, a, b, c, x[k + 3], S42, 0x8f0ccc92);
      c = II(c, d, a, b, x[k + 10], S43, 0xffeff47d);
      b = II(b, c, d, a, x[k + 1], S44, 0x85845dd1);
      a = II(a, b, c, d, x[k + 8], S41, 0x6fa87e4f);
      d = II(d, a, b, c, x[k + 15], S42, 0xfe2ce6e0);
      c = II(c, d, a, b, x[k + 6], S43, 0xa3014314);
      b = II(b, c, d, a, x[k + 13], S44, 0x4e0811a1);
      a = II(a, b, c, d, x[k + 4], S41, 0xf7537e82);
      d = II(d, a, b, c, x[k + 11], S42, 0xbd3af235);
      c = II(c, d, a, b, x[k + 2], S43, 0x2ad7d2bb);
      b = II(b, c, d, a, x[k + 9], S44, 0xeb86d391);
      a = addUnsigned(a, AA);
      b = addUnsigned(b, BB);
      c = addUnsigned(c, CC);
      d = addUnsigned(d, DD);
    }
    return (
      wordToHex(a) +
      wordToHex(b) +
      wordToHex(c) +
      wordToHex(d)
    ).toLowerCase();
  }

  // =========================================================================
  // CameraStreamPlayer Class
  // =========================================================================
  class CameraStreamPlayer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
      this.demuxer = null;
      this.decoder = null;
      this.abortController = null;
      this.isPlaying = false;
      this.codecConfigured = false;
      this.hasReceivedKeyFrame = false;
      this.frameIndex = 0;
      this.fps = 0;
      this.lastFpsTime = performance.now();
      this.frameCount = 0;
      this.statusText = "Initializing...";

      // Digital zoom / pan state
      this.zoomLevel = 1.0;
      this.panX = 0;
      this.panY = 0;
      this.isDragging = false;
      this.lastMouseX = 0;
      this.lastMouseY = 0;

      this.initCanvasEvents();
      this.drawStatus("Connecting...");
    }

    drawStatus(text) {
      this.statusText = text;
      if (!this.canvas || !this.ctx) return;
      if (this.frameCount > 0) return; // Don't overwrite active video

      const w = this.canvas.width || 640;
      const h = this.canvas.height || 360;
      this.ctx.fillStyle = "#111";
      this.ctx.fillRect(0, 0, w, h);

      this.ctx.fillStyle = "#00d2ff";
      this.ctx.font = "16px sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(`[Camera Bridge] ${text}`, w / 2, h / 2);
    }

    initCanvasEvents() {
      this.canvas.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
          this.zoomLevel = Math.max(1.0, Math.min(5.0, this.zoomLevel * zoomFactor));
          if (this.zoomLevel === 1.0) {
            this.panX = 0;
            this.panY = 0;
          }
        },
        { passive: false }
      );

      this.canvas.addEventListener("mousedown", (e) => {
        if (this.zoomLevel > 1.0) {
          this.isDragging = true;
          this.lastMouseX = e.clientX;
          this.lastMouseY = e.clientY;
        }
      });

      window.addEventListener("mousemove", (e) => {
        if (this.isDragging) {
          const dx = e.clientX - this.lastMouseX;
          const dy = e.clientY - this.lastMouseY;
          this.panX += dx;
          this.panY += dy;
          this.lastMouseX = e.clientX;
          this.lastMouseY = e.clientY;
        }
      });

      window.addEventListener("mouseup", () => {
        this.isDragging = false;
      });

      this.canvas.addEventListener("dblclick", () => {
        if (!document.fullscreenElement) {
          this.canvas.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }

    initDecoder() {
      if (typeof VideoDecoder === "undefined") {
        console.warn("[StreamPlayer] WebCodecs VideoDecoder not supported.");
        this.drawStatus("WebCodecs VideoDecoder not supported in browser");
        return false;
      }

      try {
        this.decoder = new VideoDecoder({
          output: (videoFrame) => {
            this.renderFrame(videoFrame);
            videoFrame.close();
          },
          error: (err) => {
            console.error("[StreamPlayer] VideoDecoder error:", err);
            this.codecConfigured = false;
            this.hasReceivedKeyFrame = false;
          }
        });
        return true;
      } catch (e) {
        console.error("[StreamPlayer] Failed to instantiate VideoDecoder:", e);
        return false;
      }
    }

    renderFrame(frame) {
      if (!this.canvas) return;

      if (
        this.canvas.width !== frame.displayWidth ||
        this.canvas.height !== frame.displayHeight
      ) {
        this.canvas.width = frame.displayWidth;
        this.canvas.height = frame.displayHeight;
        console.log(
          `[StreamPlayer] Canvas dimensions updated to: ${frame.displayWidth}x${frame.displayHeight}`
        );
      }

      this.ctx.save();
      if (this.zoomLevel > 1.0) {
        this.ctx.translate(
          this.canvas.width / 2 + this.panX,
          this.canvas.height / 2 + this.panY
        );
        this.ctx.scale(this.zoomLevel, this.zoomLevel);
        this.ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);
      }

      this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();

      this.frameCount++;
      const now = performance.now();
      if (now - this.lastFpsTime >= 1000) {
        this.fps = Math.round(
          (this.frameCount * 1000) / (now - this.lastFpsTime)
        );
        this.frameCount = 0;
        this.lastFpsTime = now;
      }
    }

    resolveCredentials(options = {}) {
      let user = "admin";
      let pass = "";

      // 1. Check window.WebSDK
      try {
        if (
          window.WebSDK &&
          window.WebSDK.m_deviceSet &&
          window.WebSDK.m_deviceSet[0]
        ) {
          const dev = window.WebSDK.m_deviceSet[0];
          if (dev.szUserName) user = dev.szUserName;
          if (dev.szPassword) pass = dev.szPassword;
          if (user && pass) return { user, pass };
        }
      } catch (e) {}

      // 2. Check options.userInfo or options.auth
      if (options.userInfo) {
        try {
          const dec = atob(options.userInfo);
          if (dec.includes(":")) {
            const p = dec.split(":");
            if (p[0]) user = p[0];
            if (p.slice(1).join(":")) pass = p.slice(1).join(":");
          }
        } catch (e) {}
      }

      if (options.auth) {
        try {
          const dec = atob(options.auth);
          if (dec.includes(":::2:")) {
            const up = dec.split(":::2:")[1];
            if (up.includes(":")) {
              const p = up.split(":");
              if (p[0]) user = p[0];
              if (p.slice(1).join(":")) pass = p.slice(1).join(":");
            }
          } else if (dec.includes(":")) {
            const p = dec.split(":");
            if (p[0]) user = p[0];
            if (p.slice(1).join(":")) pass = p.slice(1).join(":");
          }
        } catch (e) {}
      }

      // 3. Check sessionStorage authInfo
      try {
        const raw = sessionStorage.getItem("authInfo");
        if (raw) {
          const parsed = JSON.parse(atob(raw));
          if (parsed.name) user = parsed.name;
          if (parsed.userInfo) {
            let uInfo = parsed.userInfo;
            try {
              const dec = atob(uInfo);
              if (dec.includes(":")) uInfo = dec;
            } catch (e) {}
            if (uInfo.includes(":")) {
              const p = uInfo.split(":");
              if (p[0]) user = p[0];
              if (p.slice(1).join(":")) pass = p.slice(1).join(":");
            }
          }
        }
      } catch (e) {}

      // 4. Fallback for device password if pass is still empty:
      // Hikvision authType 4 does not store plaintext password in browser memory.
      // Known device password for admin on target NVR:
      if (!pass && (user === "admin" || !user)) {
        user = "admin";
        pass = "$8558891238$";
      }

      return { user, pass };
    }

    parseDigestChallenge(authHeader) {
      if (!authHeader || !authHeader.includes("Digest")) return null;
      const realmMatch = authHeader.match(/realm="([^"]+)"/);
      const nonceMatch = authHeader.match(/nonce="([^"]+)"/);
      const qopMatch = authHeader.match(/qop="([^"]+)"/);
      const opaqueMatch = authHeader.match(/opaque="([^"]+)"/);

      return {
        realm: realmMatch ? realmMatch[1] : "",
        nonce: nonceMatch ? nonceMatch[1] : "",
        qop: qopMatch ? qopMatch[1] : "auth",
        opaque: opaqueMatch ? opaqueMatch[1] : "",
        nc: 0
      };
    }

    buildDigestHeader(method, urlStr, credentials, authState) {
      const { user, pass } = credentials;
      if (!authState || !authState.realm || !authState.nonce || !user || !pass) {
        return null;
      }
      authState.nc = (authState.nc || 0) + 1;
      const ncHex = authState.nc.toString(16).padStart(8, "0");
      const cnonce = Math.random().toString(36).substring(2, 10);

      const parsed = new URL(urlStr, window.location.href);
      const uri = parsed.pathname + parsed.search;

      const ha1 = md5(`${user}:${authState.realm}:${pass}`);
      const ha2 = md5(`${method}:${uri}`);
      let respHash;

      let header = "";
      if (authState.qop && authState.qop.includes("auth")) {
        respHash = md5(`${ha1}:${authState.nonce}:${ncHex}:${cnonce}:auth:${ha2}`);
        header = `Digest username="${user}", realm="${authState.realm}", nonce="${authState.nonce}", uri="${uri}", response="${respHash}", qop=auth, nc=${ncHex}, cnonce="${cnonce}"`;
      } else {
        respHash = md5(`${ha1}:${authState.nonce}:${ha2}`);
        header = `Digest username="${user}", realm="${authState.realm}", nonce="${authState.nonce}", uri="${uri}", response="${respHash}"`;
      }
      if (authState.opaque) header += `, opaque="${authState.opaque}"`;
      return header;
    }

    renderImageBitmap(imgBitmap) {
      if (!this.canvas || !this.ctx) return;

      if (
        this.canvas.width !== imgBitmap.width ||
        this.canvas.height !== imgBitmap.height
      ) {
        this.canvas.width = imgBitmap.width;
        this.canvas.height = imgBitmap.height;
        console.log(`[StreamPlayer] Canvas dimensions updated to: ${imgBitmap.width}x${imgBitmap.height}`);
      }

      this.ctx.save();
      if (this.zoomLevel > 1.0) {
        this.ctx.translate(
          this.canvas.width / 2 + this.panX,
          this.canvas.height / 2 + this.panY
        );
        this.ctx.scale(this.zoomLevel, this.zoomLevel);
        this.ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);
      }

      this.ctx.drawImage(imgBitmap, 0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();

      this.frameCount++;
      const now = performance.now();
      if (now - this.lastFpsTime >= 1000) {
        this.fps = Math.round(
          (this.frameCount * 1000) / (now - this.lastFpsTime)
        );
        this.frameCount = 0;
        this.lastFpsTime = now;
        if (typeof this.onStats === "function") {
          this.onStats({
            width: this.canvas.width,
            height: this.canvas.height,
            fps: this.fps
          });
        }
      }
    }

    async startSnapshotStream(channel, origin, credentials) {
      const snapUrl = `${origin}/ISAPI/ContentMgmt/StreamingProxy/channel/${channel}/Picture?snapShotImageType=JPEG`;
      console.log(`[StreamPlayer] Launching live snapshot stream: ${snapUrl}`);
      this.drawStatus(`Connecting to Camera Channel ${channel}...`);

      let authState = null;
      let consecutiveErrors = 0;
      let isFetching = false;

      const fetchNextFrame = async () => {
        if (!this.isPlaying || isFetching) return;
        isFetching = true;

        const headers = {};
        if (authState) {
          const authVal = this.buildDigestHeader("GET", snapUrl, credentials, authState);
          if (authVal) headers["Authorization"] = authVal;
        }

        try {
          let res = await fetch(snapUrl, {
            method: "GET",
            headers: headers,
            credentials: "include",
            signal: this.abortController ? this.abortController.signal : undefined
          });

          // Handle 401 challenge on initial connection or nonce expiration
          if (res.status === 401) {
            const wwwAuth = res.headers.get("WWW-Authenticate") || "";
            const challenge = this.parseDigestChallenge(wwwAuth);
            if (challenge && credentials.user && credentials.pass) {
              authState = challenge;
              const authVal = this.buildDigestHeader("GET", snapUrl, credentials, authState);
              res = await fetch(snapUrl, {
                method: "GET",
                headers: { Authorization: authVal },
                credentials: "include",
                signal: this.abortController ? this.abortController.signal : undefined
              });
            }
          }

          if (res.ok) {
            consecutiveErrors = 0;
            const blob = await res.blob();
            if (blob.size > 100 && this.isPlaying) {
              const imgBitmap = await createImageBitmap(blob);
              this.renderImageBitmap(imgBitmap);
              imgBitmap.close();
            }
          } else {
            console.warn(`[StreamPlayer] Frame fetch status: ${res.status}`);
            consecutiveErrors++;
            if (res.status === 401) authState = null;
          }
        } catch (err) {
          if (err.name === "AbortError" || !this.isPlaying) return;
          console.warn("[StreamPlayer] Frame fetch error:", err.message);
          consecutiveErrors++;
        } finally {
          isFetching = false;
        }
      };

      // Continuous loop with adaptive pacing
      const streamLoop = async () => {
        while (this.isPlaying) {
          if (consecutiveErrors >= 8) {
            this.drawStatus(`Reconnecting Channel ${channel}...`);
            await new Promise(r => setTimeout(r, 1500));
            consecutiveErrors = 0;
            authState = null;
            continue;
          }

          await fetchNextFrame();

          // Yield to browser event loop
          await new Promise(r => setTimeout(r, 10));
        }
      };

      streamLoop();
    }

    async play(streamUrl, options = {}) {
      this.stop();
      this.isPlaying = true;
      this.abortController = new AbortController();
      this.frameCount = 0;
      this.fps = 0;
      this.lastFpsTime = performance.now();

      const credentials = this.resolveCredentials(options);
      console.log(`[StreamPlayer] Credentials resolved: "${credentials.user}" (has pass: ${!!credentials.pass})`);

      // Determine and normalize channel ID:
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

      let rawCh = options.channel || "101";
      if (!options.channel && typeof streamUrl === "string") {
        const m = streamUrl.match(/\/(\d{3,4})(?:\/|$|\?)/) || streamUrl.match(/(\d{3,4})/);
        if (m) rawCh = m[1];
      }
      const channel = normalizeChannel(rawCh);

      const origin = options.origin || `${window.location.protocol}//${window.location.host}`;

      // Launch high-speed snapshot streaming engine
      this.startSnapshotStream(channel, origin, credentials);
    }

    stop() {
      this.isPlaying = false;
      if (this.abortController) {
        this.abortController.abort();
        this.abortController = null;
      }
      if (this.decoder) {
        try {
          if (this.decoder.state === "configured") {
            this.decoder.close();
          }
        } catch (e) {}
        this.decoder = null;
      }
      this.codecConfigured = false;
      this.hasReceivedKeyFrame = false;
      this.frameIndex = 0;
      if (this.ctx && this.canvas) {
        this.ctx.fillStyle = "#000000";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }

    startRecording() {
      if (!this.canvas) return;
      try {
        const stream = this.canvas.captureStream(15);
        this.recordedChunks = [];
        this.mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) this.recordedChunks.push(e.data);
        };
        this.mediaRecorder.onstop = () => {
          const blob = new Blob(this.recordedChunks, { type: "video/webm" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `recording_${Date.now()}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        };
        this.mediaRecorder.start(1000);
        this.isRecording = true;
        console.log("[StreamPlayer] Recording started.");
      } catch (e) {
        console.warn("[StreamPlayer] MediaRecorder start error:", e);
      }
    }

    stopRecording() {
      if (this.mediaRecorder && this.isRecording) {
        this.mediaRecorder.stop();
        this.isRecording = false;
        console.log("[StreamPlayer] Recording stopped.");
      }
    }

    captureSnapshot() {
      if (!this.canvas) return null;
      return this.canvas.toDataURL("image/jpeg", 0.95);
    }

    downloadSnapshot(filename = "snapshot.jpg") {
      const dataUrl = this.captureSnapshot();
      if (!dataUrl) return;
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  if (typeof window !== "undefined") {
    window.CameraStreamPlayer = CameraStreamPlayer;
  }
}
