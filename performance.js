import { onCLS, onINP, onLCP } from "/node_modules/web-vitals/dist/web-vitals.js";

const performanceMetrics = {
  pageLoad: null,
  lcp: null,
  inp: null,
  cls: 0,
  longTaskCount: 0,
  longestTask: 0
};

const officialWebVitals = {
  LCP: null,
  INP: null,
  CLS: null
};

const pageLoadMetric = document.querySelector("#metric-page-load");
const lcpMetric = document.querySelector("#metric-lcp");
const inpMetric = document.querySelector("#metric-inp");
const clsMetric = document.querySelector("#metric-cls");
const longTasksMetric = document.querySelector("#metric-long-tasks");
const longestTaskMetric = document.querySelector("#metric-longest-task");
const telemetryMessage = document.querySelector("#telemetry-message");
const sendTelemetryButton = document.querySelector("#send-telemetry-button");
const slowLcpButton = document.querySelector("#slow-lcp-button");
const clsButton = document.querySelector("#cls-button");
const officialMetricElements = {
  LCP: document.querySelector("#metric-official-lcp"),
  INP: document.querySelector("#metric-official-inp"),
  CLS: document.querySelector("#metric-official-cls")
};
const officialRatingElements = {
  LCP: document.querySelector("#rating-official-lcp"),
  INP: document.querySelector("#rating-official-inp"),
  CLS: document.querySelector("#rating-official-cls")
};

function formatMilliseconds(value) {
  return value == null ? "—" : `${Math.round(value)} ms`;
}

function renderPerformanceMetrics() {
  pageLoadMetric.textContent = formatMilliseconds(performanceMetrics.pageLoad);
  lcpMetric.textContent = formatMilliseconds(performanceMetrics.lcp);
  inpMetric.textContent = formatMilliseconds(performanceMetrics.inp);
  clsMetric.textContent = performanceMetrics.cls.toFixed(3);
  longTasksMetric.textContent = String(performanceMetrics.longTaskCount);
  longestTaskMetric.textContent = formatMilliseconds(performanceMetrics.longestTask || null);
}

function renderOfficialMetric(metric) {
  officialWebVitals[metric.name] = {
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id
  };

  officialMetricElements[metric.name].textContent = metric.name === "CLS"
    ? metric.value.toFixed(3)
    : formatMilliseconds(metric.value);
  officialRatingElements[metric.name].textContent = metric.rating;
  officialRatingElements[metric.name].className = `metric-rating ${metric.rating}`;
}

onLCP(renderOfficialMetric, { reportAllChanges: true });
onINP(renderOfficialMetric, { reportAllChanges: true });
onCLS(renderOfficialMetric, { reportAllChanges: true });

function observe(type, callback, options = {}) {
  try {
    const observer = new PerformanceObserver((list) => {
      callback(list.getEntries());
    });

    observer.observe({ type, buffered: true, ...options });
    return observer;
  } catch (error) {
    console.warn(`Performance entry type "${type}" is not supported.`, error);
    return null;
  }
}

function measurePageLoad() {
  const navigation = performance.getEntriesByType("navigation")[0];

  if (navigation) {
    performanceMetrics.pageLoad = navigation.loadEventEnd > 0
      ? navigation.loadEventEnd
      : navigation.duration;
    renderPerformanceMetrics();
  }
}

observe("largest-contentful-paint", (entries) => {
  const latestEntry = entries.at(-1);

  if (latestEntry) {
    performanceMetrics.lcp = latestEntry.startTime;
    renderPerformanceMetrics();
  }
});

observe("layout-shift", (entries) => {
  for (const entry of entries) {
    if (!entry.hadRecentInput) {
      performanceMetrics.cls += entry.value;
    }
  }

  renderPerformanceMetrics();
});

observe("longtask", (entries) => {
  for (const entry of entries) {
    performanceMetrics.longTaskCount += 1;
    performanceMetrics.longestTask = Math.max(performanceMetrics.longestTask, entry.duration);
  }

  renderPerformanceMetrics();
});

observe("event", (entries) => {
  for (const entry of entries) {
    if (entry.interactionId && entry.duration > (performanceMetrics.inp ?? 0)) {
      performanceMetrics.inp = entry.duration;
    }
  }

  renderPerformanceMetrics();
}, { durationThreshold: 16 });

function prepareSlowLcpExperiment() {
  const params = new URLSearchParams(window.location.search);

  if (params.get("slowLcp") !== "true") {
    return;
  }

  const placeholder = document.querySelector("#slow-lcp-placeholder");

  setTimeout(() => {
    const content = document.createElement("p");
    content.textContent = "Nội dung chính xuất hiện chậm sau 1,8 giây";
    placeholder.append(content);
  }, 1800);
}

slowLcpButton.addEventListener("click", () => {
  window.location.href = "/?slowLcp=true";
});

clsButton.addEventListener("click", () => {
  clsButton.disabled = true;
  telemetryMessage.className = "message loading";
  telemetryMessage.textContent = "Chờ 700 ms; banner sẽ được chèn và đẩy nội dung xuống...";

  setTimeout(() => {
    const banner = document.createElement("div");
    banner.className = "layout-shift-banner";
    banner.textContent = "Banner xuất hiện mà không chừa chỗ trước — layout đã bị dịch chuyển.";
    document.querySelector("main").before(banner);
    telemetryMessage.className = "message";
    telemetryMessage.textContent = "Layout shift đã được tạo. Quan sát chỉ số CLS.";
  }, 700);
});

sendTelemetryButton.addEventListener("click", async () => {
  sendTelemetryButton.disabled = true;
  telemetryMessage.className = "message loading";
  telemetryMessage.textContent = "Đang gửi browser telemetry...";

  try {
    const response = await fetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "browser-performance",
        url: window.location.href,
        userAgent: navigator.userAgent,
        metrics: performanceMetrics,
        webVitals: officialWebVitals
      })
    });
    const body = await response.json();

    telemetryMessage.className = "message";
    telemetryMessage.textContent = `Server accepted telemetry. Total events: ${body.totalEvents}.`;
  } catch (error) {
    telemetryMessage.className = "message error";
    telemetryMessage.textContent = error.message;
  } finally {
    sendTelemetryButton.disabled = false;
  }
});

window.browserLab ??= {};
window.browserLab.performanceMetrics = performanceMetrics;
window.browserLab.webVitals = officialWebVitals;
window.addEventListener("load", () => {
  setTimeout(measurePageLoad, 0);
});
prepareSlowLcpExperiment();
renderPerformanceMetrics();
