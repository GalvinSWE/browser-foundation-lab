const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const host = "127.0.0.1";
const port = Number(process.env.PORT ?? 4173);
const publicDirectory = __dirname;

const reservations = [
  {
    id: "RES-1001",
    guestName: "Nguyen Van An",
    room: "Deluxe 301",
    checkIn: "2026-08-25",
    checkOut: "2026-08-28",
    status: "confirmed"
  },
  {
    id: "RES-1002",
    guestName: "Tran Minh Chau",
    room: "Suite 502",
    checkIn: "2026-08-26",
    checkOut: "2026-08-30",
    status: "pending"
  },
  {
    id: "RES-1003",
    guestName: "Le Hoang Nam",
    room: "Standard 204",
    checkIn: "2026-08-27",
    checkOut: "2026-08-29",
    status: "cancelled"
  }
];

const telemetryEvents = [];

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

async function serveStaticFile(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = path.normalize(requestPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDirectory, safePath);

  if (!filePath.startsWith(publicDirectory)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] ?? "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(file);
  } catch (error) {
    if (error.code === "ENOENT") {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    console.error(error);
    response.writeHead(500);
    response.end("Internal server error");
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  console.log(`${new Date().toISOString()} ${request.method} ${url.pathname}`);

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, { status: "healthy", service: "browser-foundation-lab" });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/telemetry") {
    try {
      const body = await readJsonBody(request);
      const event = {
        ...body,
        receivedAt: new Date().toISOString()
      };

      telemetryEvents.push(event);
      console.log("BROWSER_TELEMETRY", JSON.stringify(event));
      sendJson(response, 202, { accepted: true, totalEvents: telemetryEvents.length });
    } catch {
      sendJson(response, 400, { message: "Invalid telemetry payload" });
    }
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/telemetry") {
    sendJson(response, 200, { events: telemetryEvents });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/reservations") {
    const delay = Number(url.searchParams.get("delay") ?? 800);
    const shouldFail = url.searchParams.get("fail") === "true";

    await new Promise((resolve) => setTimeout(resolve, Math.min(Math.max(delay, 0), 5000)));

    if (shouldFail) {
      sendJson(response, 500, {
        code: "RESERVATION_SERVICE_ERROR",
        message: "This is an intentional lab error."
      });
      return;
    }

    sendJson(response, 200, {
      reservations,
      servedAt: new Date().toISOString()
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/reservations") {
    try {
      const input = await readJsonBody(request);
      const nextNumber = 1001 + reservations.length;
      const reservation = {
        id: `RES-${nextNumber}`,
        guestName: input.guestName ?? `Lab Guest ${nextNumber}`,
        room: input.room ?? "Standard 101",
        checkIn: input.checkIn ?? "2026-09-01",
        checkOut: input.checkOut ?? "2026-09-03",
        status: "confirmed"
      };

      reservations.push(reservation);
      sendJson(response, 201, { reservation });
    } catch {
      sendJson(response, 400, { message: "Invalid JSON body" });
    }
    return;
  }

  if (request.method !== "GET") {
    sendJson(response, 405, { message: "Method not allowed" });
    return;
  }

  await serveStaticFile(request, response);
});

server.listen(port, host, () => {
  console.log(`Browser Foundation Lab: http://${host}:${port}`);
  console.log(`Health check: http://${host}:${port}/api/health`);
});
