/**
 * Polls /api/trending/ every 5s (page 1 only) and updates .trending-val metrics by slug.
 * First fetch runs immediately on load for instant counters.
 */
(function () {
  const root = document.getElementById("trendingPageRoot");
  if (!root) return;
  const baseUrl = root.dataset.trendingApiUrl;
  if (!baseUrl) return;

  const statusEl = document.getElementById("trendingPollStatus");
  const params = new URLSearchParams(window.location.search);
  const page = params.get("page") || "1";
  if (page !== "1") {
    if (statusEl) statusEl.textContent = "";
    return;
  }

  function mergeRows(data) {
    const map = {};
    ["hot", "rising", "feed"].forEach((k) => {
      (data[k] || []).forEach((row) => {
        if (row.slug) map[row.slug] = row;
      });
    });
    return map;
  }

  function applyRow(slug, row) {
    const containers = Array.prototype.filter.call(
      document.querySelectorAll("[data-trending-slug]"),
      function (el) {
        return el.getAttribute("data-trending-slug") === slug;
      }
    );
    containers.forEach(function (container) {
      container.querySelectorAll("[data-metric]").forEach((el) => {
        const key = el.getAttribute("data-metric");
        if (key === undefined || row[key] === undefined) return;
        const valNode = el.querySelector(".trending-val");
        const text = String(row[key]);
        if (valNode) valNode.textContent = text;
        else el.textContent = text;
      });
    });
  }

  async function poll() {
    try {
      const res = await fetch(baseUrl + "?page=1", { credentials: "same-origin" });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.ok && data.hot === undefined) return;
      const map = mergeRows(data);
      Object.keys(map).forEach((slug) => applyRow(slug, map[slug]));
      if (statusEl) {
        statusEl.textContent =
          "Live · " +
          new Date().toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          });
      }
    } catch (e) {
      /* ignore */
    }
  }

  poll();
  setInterval(poll, 5000);
})();
