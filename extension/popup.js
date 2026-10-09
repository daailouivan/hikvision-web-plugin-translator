document.addEventListener("DOMContentLoaded", () => {
  const openViewerBtn = document.getElementById("openViewerBtn");
  const snapBtn = document.getElementById("snapBtn");
  const fullBtn = document.getElementById("fullBtn");
  const streamSelect = document.getElementById("streamSelect");

  // Load saved preference
  chrome.storage.local.get(["preferredStream"], (res) => {
    if (res.preferredStream) {
      streamSelect.value = res.preferredStream;
    }
  });

  streamSelect.addEventListener("change", () => {
    chrome.storage.local.set({ preferredStream: streamSelect.value });
  });

  openViewerBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_VIEWER" });
  });

  snapBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            const canvas = document.querySelector(".hik-wnd-cell.hik-wnd-selected canvas") ||
                           document.querySelector(".hik-wnd-cell.playing canvas") ||
                           document.querySelector(".hik-wnd-canvas") ||
                           document.querySelector(".hik-virtual-canvas");
            if (canvas) {
              const a = document.createElement("a");
              a.href = canvas.toDataURL("image/jpeg", 0.95);
              a.download = `camera_snapshot_${Date.now()}.jpg`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            } else {
              alert("No active camera canvas found on this page.");
            }
          }
        });
      }
    });
  });

  fullBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => {
            const container = document.getElementById("main_plugin") ||
                              document.getElementById("divPlugin") ||
                              document.querySelector(".hik-wnd-cell.hik-wnd-selected") ||
                              document.body;
            if (container) {
              if (!document.fullscreenElement) {
                container.requestFullscreen().catch(() => {});
              } else {
                document.exitFullscreen().catch(() => {});
              }
            }
          }
        });
      }
    });
  });
});
