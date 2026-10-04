const loadButton = document.querySelector("#load-button");
const refreshButton = document.querySelector("#refresh-button");
const clearCacheButton = document.querySelector("#clear-cache-button");
const createButton = document.querySelector("#create-button");
const errorButton = document.querySelector("#error-button");
const clearButton = document.querySelector("#clear-button");
const clearLogButton = document.querySelector("#clear-log-button");
const blockButton = document.querySelector("#block-button");
const workerButton = document.querySelector("#worker-button");
const liveClock = document.querySelector("#live-clock");
const experimentResult = document.querySelector("#experiment-result");
const message = document.querySelector("#message");
const reservationList = document.querySelector("#reservation-list");
const connectionStatus = document.querySelector("#connection-status");
const requestDuration = document.querySelector("#request-duration");
const eventLogList = document.querySelector("#event-log-list");
const cacheStatus = document.querySelector("#cache-status");
const cacheStoredAt = document.querySelector("#cache-stored-at");
const cacheAge = document.querySelector("#cache-age");
const cacheEntryCount = document.querySelector("#cache-entry-count");
const cacheObservers = document.querySelector("#cache-observers");
const gcCountdown = document.querySelector("#gc-countdown");
const unmountButton = document.querySelector("#unmount-button");
const mountButton = document.querySelector("#mount-button");
const reservationView = document.querySelector("#reservation-view");

const queryCache = new Map();
const reservationQueryKey = "reservations";
const staleTime = 10_000;
const gcTime = 5_000;
let reservationViewMounted = true;
let gcDeadline = null;
let gcTimer = null;

window.browserLab = {
  queryCache,
  staleTime,
  gcTime
};

function addEventLog(text) {
  const item = document.createElement("li");
  item.textContent = text;
  eventLogList.append(item);
  console.log(`[Browser Lab] ${text}`);
}

function setLoading(isLoading) {
  loadButton.disabled = isLoading;
  refreshButton.disabled = isLoading;
  errorButton.disabled = isLoading;

  if (isLoading) {
    message.className = "message loading";
    message.textContent = "Browser đang chờ API response...";
    connectionStatus.className = "connection-status";
    connectionStatus.textContent = "Đang gọi API";
  }
}

function readReservationCache() {
  const entry = queryCache.get(reservationQueryKey);

  if (!entry) {
    return { state: "empty" };
  }

  const age = Date.now() - entry.storedAt;

  return {
    state: age < staleTime ? "fresh" : "stale",
    age,
    entry
  };
}

function updateCachePanel() {
  const cache = readReservationCache();
  cacheEntryCount.textContent = String(queryCache.size);
  cacheObservers.textContent = reservationViewMounted ? "1 (active)" : "0 (inactive)";
  gcCountdown.textContent = gcDeadline
    ? `${Math.max(0, (gcDeadline - Date.now()) / 1000).toFixed(1)} s`
    : "—";

  if (cache.state === "empty") {
    cacheStatus.className = "cache-status";
    cacheStatus.textContent = "EMPTY";
    cacheStoredAt.textContent = "—";
    cacheAge.textContent = "—";
    return;
  }

  cacheStatus.className = `cache-status ${cache.state}`;
  cacheStatus.textContent = cache.state.toUpperCase();
  cacheStoredAt.textContent = new Date(cache.entry.storedAt).toLocaleTimeString("vi-VN", {
    hour12: false
  });
  cacheAge.textContent = `${(cache.age / 1000).toFixed(1)} s`;
}

function cancelGarbageCollection() {
  if (gcTimer) {
    clearTimeout(gcTimer);
  }

  gcTimer = null;
  gcDeadline = null;
  updateCachePanel();
}

function scheduleGarbageCollection() {
  cancelGarbageCollection();

  if (!queryCache.has(reservationQueryKey)) {
    addEventLog("View inactive nhưng cache đang empty; không có entry để GC.");
    return;
  }

  gcDeadline = Date.now() + gcTime;
  addEventLog(`Query không còn observer; GC được lên lịch sau ${gcTime / 1000} giây.`);

  gcTimer = setTimeout(() => {
    queryCache.delete(reservationQueryKey);
    gcTimer = null;
    gcDeadline = null;
    updateCachePanel();
    addEventLog("Garbage collection đã xóa inactive query khỏi RAM.");
  }, gcTime);
}

function updateClock() {
  liveClock.textContent = new Date().toLocaleTimeString("vi-VN", {
    hour12: false
  });
}

function runBlockingWork(durationMilliseconds) {
  const startedAt = performance.now();
  let iterations = 0;

  while (performance.now() - startedAt < durationMilliseconds) {
    iterations += 1;
    Math.sqrt(iterations);
  }

  return iterations;
}

function setExperimentRunning(text) {
  blockButton.disabled = true;
  workerButton.disabled = true;
  experimentResult.className = "message loading";
  experimentResult.textContent = text;
}

function finishExperiment(text) {
  blockButton.disabled = false;
  workerButton.disabled = false;
  experimentResult.className = "message";
  experimentResult.textContent = text;
}

function renderReservations(reservations) {
  reservationList.replaceChildren();

  for (const reservation of reservations) {
    const card = document.createElement("article");
    card.className = "reservation-card";

    const title = document.createElement("h3");
    title.textContent = `${reservation.id} — ${reservation.guestName}`;

    const details = document.createElement("dl");
    const values = [
      ["Room", reservation.room],
      ["Check-in", reservation.checkIn],
      ["Check-out", reservation.checkOut],
      ["Status", reservation.status]
    ];

    for (const [label, value] of values) {
      const term = document.createElement("dt");
      term.textContent = label;

      const description = document.createElement("dd");
      description.textContent = value;

      details.append(term, description);
    }

    card.append(title, details);
    reservationList.append(card);
  }
}

async function loadReservations({ shouldFail = false, force = false } = {}) {
  setLoading(true);
  reservationList.replaceChildren();
  requestDuration.textContent = "—";

  const startedAt = performance.now();
  const url = `/api/reservations?delay=800&fail=${shouldFail}`;

  addEventLog(`Click callback đang chạy trên main thread.`);

  if (!shouldFail && !force) {
    const cache = readReservationCache();

    if (cache.state === "fresh") {
      renderReservations(cache.entry.data);
      const duration = Math.round(performance.now() - startedAt);

      message.className = "message";
      message.textContent = `CACHE HIT: render ${cache.entry.data.length} reservations mà không gọi API.`;
      connectionStatus.className = "connection-status success";
      connectionStatus.textContent = "Frontend cache hit";
      requestDuration.textContent = `${duration} ms`;
      loadButton.disabled = false;
      refreshButton.disabled = false;
      errorButton.disabled = false;
      addEventLog(`Query Cache HIT; dữ liệu fresh nên fetch() không được gọi.`);
      updateCachePanel();
      return;
    }

    addEventLog(
      cache.state === "stale"
        ? "Query Cache STALE; vẫn còn dữ liệu nhưng phải refetch."
        : "Query Cache MISS; chưa có entry trong RAM."
    );
  } else if (force) {
    addEventLog("Force refetch bỏ qua dữ liệu fresh trong Query Cache.");
  }

  addEventLog(`fetch("${url}") được gọi; browser Network xử lý request.`);

  try {
    const response = await fetch(url);
    addEventLog(`Response quay về với HTTP ${response.status}.`);

    const body = await response.json();

    if (!response.ok) {
      throw new Error(`${body.code}: ${body.message}`);
    }

    queryCache.set(reservationQueryKey, {
      data: body.reservations,
      storedAt: Date.now()
    });
    addEventLog(`API data được lưu vào Query Cache với key "${reservationQueryKey}".`);

    renderReservations(body.reservations);

    message.className = "message";
    message.textContent = `Đã render ${body.reservations.length} reservations vào DOM.`;
    connectionStatus.className = "connection-status success";
    connectionStatus.textContent = "API thành công";
    addEventLog(`JavaScript cập nhật DOM; browser tính layout và paint lại giao diện.`);
  } catch (error) {
    message.className = "message error";
    message.textContent = error.message;
    connectionStatus.className = "connection-status error";
    connectionStatus.textContent = "API thất bại";
    addEventLog(`Error handler nhận lỗi: ${error.message}`);
    console.error(error);
  } finally {
    const duration = Math.round(performance.now() - startedAt);
    requestDuration.textContent = `${duration} ms`;
    loadButton.disabled = false;
    errorButton.disabled = false;
    refreshButton.disabled = false;
    updateCachePanel();
    addEventLog(`Request flow hoàn tất sau khoảng ${duration} ms.`);
  }
}

async function createReservationAndInvalidate() {
  createButton.disabled = true;
  addEventLog("Mutation POST /api/reservations bắt đầu.");

  try {
    const response = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    const body = await response.json();

    if (!response.ok) {
      throw new Error(body.message ?? "Create reservation failed");
    }

    addEventLog(`Mutation thành công: ${body.reservation.id} được tạo trên server.`);
    queryCache.delete(reservationQueryKey);
    updateCachePanel();
    addEventLog(`Invalidation: query key "${reservationQueryKey}" đã bị xóa.`);

    if (reservationViewMounted) {
      addEventLog("Query đang active nên refetch ngay sau invalidation.");
      await loadReservations({ force: true });
    }
  } catch (error) {
    message.className = "message error";
    message.textContent = error.message;
    addEventLog(`Mutation error: ${error.message}`);
  } finally {
    createButton.disabled = false;
  }
}

loadButton.addEventListener("click", () => {
  loadReservations();
});

refreshButton.addEventListener("click", () => {
  loadReservations({ force: true });
});

clearCacheButton.addEventListener("click", () => {
  queryCache.clear();
  cancelGarbageCollection();
  updateCachePanel();
  addEventLog("Query Cache đã bị xóa khỏi RAM của tab.");
});

createButton.addEventListener("click", () => {
  createReservationAndInvalidate();
});

unmountButton.addEventListener("click", () => {
  reservationViewMounted = false;
  reservationView.hidden = true;
  unmountButton.disabled = true;
  mountButton.disabled = false;
  scheduleGarbageCollection();
  updateCachePanel();
});

mountButton.addEventListener("click", () => {
  reservationViewMounted = true;
  reservationView.hidden = false;
  unmountButton.disabled = false;
  mountButton.disabled = true;
  cancelGarbageCollection();
  addEventLog("Reservation view mount lại và trở thành observer của query.");
  loadReservations();
});

errorButton.addEventListener("click", () => {
  loadReservations({ shouldFail: true });
});

clearButton.addEventListener("click", () => {
  reservationList.replaceChildren();
  message.className = "message";
  message.textContent = "UI đã được xóa nhưng server vẫn còn dữ liệu.";
  connectionStatus.className = "connection-status";
  connectionStatus.textContent = "Chưa gọi API";
  requestDuration.textContent = "—";
  addEventLog("JavaScript đã xóa các reservation DOM nodes.");
});

clearLogButton.addEventListener("click", () => {
  eventLogList.replaceChildren();
});

blockButton.addEventListener("click", () => {
  setExperimentRunning("Main thread đang bị block trong 3 giây...");
  addEventLog("Click handler bắt đầu công việc nặng ngay trên main thread.");

  const startedAt = performance.now();
  const iterations = runBlockingWork(3000);
  const duration = Math.round(performance.now() - startedAt);

  finishExperiment(
    `Main thread hoàn tất ${iterations.toLocaleString()} vòng lặp sau ${duration} ms. Đồng hồ đã đứng trong thời gian này.`
  );
  addEventLog(`Long task nằm trong click interaction và kết thúc sau ${duration} ms.`);
});

workerButton.addEventListener("click", () => {
  setExperimentRunning("Web Worker đang tính toán trong 3 giây...");
  addEventLog("Main thread gửi công việc sang Web Worker.");

  const worker = new Worker("/worker.js");

  worker.addEventListener("message", (event) => {
    finishExperiment(
      `Worker hoàn tất ${event.data.iterations.toLocaleString()} vòng lặp sau ${event.data.duration} ms. Đồng hồ vẫn chạy.`
    );
    addEventLog("Worker gửi kết quả về; main thread cập nhật DOM.");
    worker.terminate();
  });

  worker.addEventListener("error", (event) => {
    experimentResult.className = "message error";
    experimentResult.textContent = event.message;
    blockButton.disabled = false;
    workerButton.disabled = false;
    worker.terminate();
  });

  worker.postMessage({ duration: 3000 });
});

updateClock();
setInterval(updateClock, 100);
updateCachePanel();
setInterval(updateCachePanel, 250);
addEventLog("app.js đã chạy và đăng ký các click event listeners.");
