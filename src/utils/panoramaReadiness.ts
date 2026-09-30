// Google exposes panorama metadata status, but no documented all-tiles-loaded
// event. Observe browser-managed imagery completion and DOM image readiness,
// then allow a quiet period and two paints. Never fetch imagery ourselves.
export function isGoogleImagery(url: string): boolean {
  try {
    const { hostname, pathname } = new URL(url);
    return (
      /(^|\.)(googleapis|googleusercontent|google|ggpht)\.com$/.test(
        hostname,
      ) &&
      (/googleusercontent|ggpht/.test(hostname) ||
        /streetview|cbk|tile|photometa|\/maps\/vt/i.test(pathname))
    );
  } catch {
    return false;
  }
}
export function createPanoramaReadinessGate(
  host: HTMLElement,
  ready: () => void,
  failed: (message: string) => void,
) {
  const started = Date.now();
  let lastActivity = started,
    available = false,
    active = true;
  let firstPaint = 0,
    secondPaint = 0;
  const activity = () => {
    lastActivity = Date.now();
  };
  const observer =
    typeof PerformanceObserver === "undefined"
      ? undefined
      : new PerformanceObserver((list) => {
          if (list.getEntries().some((entry) => isGoogleImagery(entry.name)))
            activity();
        });
  observer?.observe({ type: "resource", buffered: false });
  const mutations = new MutationObserver(activity);
  mutations.observe(host, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "srcset"],
  });
  function dispose() {
    active = false;
    clearInterval(poll);
    observer?.disconnect();
    mutations.disconnect();
    cancelAnimationFrame(firstPaint);
    cancelAnimationFrame(secondPaint);
  }
  const poll = setInterval(() => {
    if (!active) return;
    const now = Date.now();
    if (now - started >= 60000) {
      dispose();
      failed(
        "Street View is taking too long to load. Playback paused; try the next view or check your connection.",
      );
      return;
    }
    if (!available || now - started < 2500 || now - lastActivity < 1500) return;
    const images = [...host.querySelectorAll("img")].filter((img) =>
      isGoogleImagery(img.currentSrc || img.src),
    );
    if (images.some((img) => !img.complete)) return;
    if (images.some((img) => img.naturalWidth === 0)) {
      dispose();
      failed(
        "Street View imagery couldn’t load. Playback paused; try the next view.",
      );
      return;
    }
    if (firstPaint) return;
    firstPaint = requestAnimationFrame(() => {
      secondPaint = requestAnimationFrame(() => {
        firstPaint = 0;
        if (!active || Date.now() - lastActivity < 1500) return;
        dispose();
        ready();
      });
    });
  }, 250);
  return {
    dispose,
    markAvailable() {
      available = true;
      activity();
    },
  };
}
