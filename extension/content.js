/**
 * Content Script (Isolated World)
 * Injects CSS rules and provides fallback script injection for browsers that do not support world: "MAIN".
 */

(function () {
  // Inject default canvas styling into document
  const style = document.createElement("style");
  style.id = "hik-virtual-canvas-isolated-style";
  style.textContent = `
    #main_plugin, #divPlugin, #play_window, #liveview_play {
      position: relative !important;
      background: #121212 !important;
      overflow: hidden !important;
    }
    #main_plugin table, #divPlugin table {
      display: none !important;
    }
  `;
  (document.head || document.documentElement).appendChild(style);

  // Fallback injector: if world: "MAIN" was not executed by the browser engine
  function injectFallback(file) {
    const s = document.createElement("script");
    s.src = chrome.runtime.getURL(file);
    s.async = false;
    (document.head || document.documentElement).appendChild(s);
    s.onload = () => s.remove();
  }

  // The scripts have idempotency guards (`window.__HIK_VIRTUAL_SERVICE_ACTIVE__`),
  // so executing them as fallback is safe and guarantees initialization.
  injectFallback("h264-demuxer.js");
  injectFallback("stream-player.js");
  injectFallback("page-hook.js");
})();
