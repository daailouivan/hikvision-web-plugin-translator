/**
 * Content Script (Isolated World)
 * Injects CSS rules and provides fallback script injection for browsers that do not support world: "MAIN".
 */

(function () {
  // Inject default canvas styling into document
  const style = document.createElement("style");
  style.id = "hik-virtual-canvas-isolated-style";
  style.textContent = `
    #main_plugin:not(.no-window), #divPlugin:not(.no-window), #play_window:not(.no-window), #liveview_play:not(.no-window) {
      position: relative !important;
      background: #121212 !important;
      overflow: hidden !important;
    }
    #main_plugin:not(.no-window) table, #divPlugin:not(.no-window) table {
      display: none !important;
    }
    #main_plugin.no-window, #divPlugin.no-window, .no-window {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
      min-height: 0 !important;
      max-height: 0 !important;
      border: none !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
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
