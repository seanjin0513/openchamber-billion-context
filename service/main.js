"use strict";

// src/service.js
var http = require("node:http");
var fs = require("node:fs");
var fsp = require("node:fs/promises");
var os = require("node:os");
var path = require("node:path");
var { spawn } = require("node:child_process");
var PORT = Number(process.env.OPENCHAMBER_SERVICE_PORT);
var TOKEN = process.env.OPENCHAMBER_SERVICE_TOKEN || "";
var HOME = os.homedir();
var STATE_DIR = path.join(
  process.env.XDG_STATE_HOME && process.env.XDG_STATE_HOME.trim() ? process.env.XDG_STATE_HOME : path.join(HOME, ".local", "state"),
  "billion-context"
);
var HEALTH_TIMEOUT_MS = 1200;
var HEALTH_BODY_LIMIT = 128 * 1024;
var START_WAIT_MS = 15e3;
var START_POLL_MS = 400;
var LOOPBACK_HOSTS = /* @__PURE__ */ new Set(["127.0.0.1", "localhost", "[::1]", "::1", "0.0.0.0"]);
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function normalizeOrigin(value) {
  if (typeof value !== "string") return void 0;
  const raw = value.trim();
  if (!raw) return void 0;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return void 0;
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return void 0;
    let host = url.hostname;
    if (host === "0.0.0.0") host = "127.0.0.1";
    if (!LOOPBACK_HOSTS.has(url.hostname) && host !== "127.0.0.1") return void 0;
    return `${url.protocol}//${host}${url.port ? `:${url.port}` : ""}`;
  } catch {
    return void 0;
  }
}
async function readJson(file) {
  try {
    return JSON.parse(await fsp.readFile(file, "utf8"));
  } catch {
    return void 0;
  }
}
async function readPointer(file) {
  try {
    const raw = (await fsp.readFile(file, "utf8")).trim();
    if (!raw) return void 0;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  } catch {
    return void 0;
  }
}
function pidAlive(pid) {
  if (typeof pid !== "number" || !Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return Boolean(error && typeof error === "object" && error.code === "EPERM");
  }
}
function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload)
  });
  res.end(payload);
}
async function readCandidates() {
  const candidates = [];
  const seen = /* @__PURE__ */ new Set();
  const push = (origin, lane, pid, startedAt, source, alive) => {
    const normalized = normalizeOrigin(origin);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push({
      origin: normalized,
      lane: typeof lane === "string" && lane ? lane : null,
      pid: Number.isInteger(pid) ? pid : null,
      startedAt: Number.isFinite(startedAt) ? startedAt : 0,
      source,
      alive: alive !== false
    });
  };
  const instancesDir = path.join(STATE_DIR, "instances");
  let names = [];
  try {
    names = await fsp.readdir(instancesDir);
  } catch {
    names = [];
  }
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const entry = await readJson(path.join(instancesDir, name));
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    push(entry.origin, entry.lane, entry.pid, entry.startedAt, "registry", pidAlive(entry.pid));
  }
  const pointer = await readPointer(path.join(STATE_DIR, "proxy-origin"));
  if (typeof pointer === "string") {
    push(pointer, null, null, 0, "pointer", true);
  } else if (pointer && typeof pointer === "object" && !Array.isArray(pointer)) {
    push(pointer.origin, pointer.lane, pointer.pid, pointer.startedAt, "pointer", pidAlive(pointer.pid));
  }
  const zone = await readJson(path.join(STATE_DIR, "port-zone.json"));
  const lanes = zone && typeof zone === "object" && zone.lanes && typeof zone.lanes === "object" ? zone.lanes : {};
  for (const [lane, port] of Object.entries(lanes)) {
    if (Number.isInteger(port) && port > 0 && port < 65536) {
      push(`http://127.0.0.1:${port}`, lane, null, 0, "port-zone", true);
    }
  }
  push("http://127.0.0.1:8787", null, null, 0, "default", true);
  return candidates;
}
async function probe(origin) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(`${origin}/__bili/health`, {
      method: "GET",
      headers: { accept: "application/json", "user-agent": "openchamber-billion-context" },
      redirect: "error",
      signal: controller.signal
    });
    if (response.status !== 200) return null;
    const text = await response.text();
    if (text.length > HEALTH_BODY_LIMIT) return null;
    const data = JSON.parse(text);
    if (!data || typeof data !== "object" || data.ok !== true) return null;
    if (typeof data.version !== "string" || !data.version) return null;
    return {
      version: data.version,
      instanceId: typeof data.instanceId === "string" ? data.instanceId : null,
      pid: Number.isInteger(data.pid) ? data.pid : null,
      startedAt: Number.isFinite(data.startedAt) ? data.startedAt : null,
      upstream: typeof data.upstream === "string" ? data.upstream : null
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
function laneRank(lane) {
  if (lane === "opencode") return 0;
  if (lane === "pi") return 1;
  if (lane === "dsh") return 2;
  if (lane) return 3;
  return 4;
}
function compareTargets(a, b) {
  return laneRank(a.lane) - laneRank(b.lane) || (b.startedAt || 0) - (a.startedAt || 0) || a.origin.localeCompare(b.origin);
}
async function collectTargets() {
  const candidates = await readCandidates();
  const probed = await Promise.all(
    candidates.map(async (candidate) => {
      const health = await probe(candidate.origin);
      if (!health) return null;
      return {
        origin: candidate.origin,
        lane: candidate.lane,
        version: health.version,
        instanceId: health.instanceId,
        pid: health.pid ?? candidate.pid,
        startedAt: health.startedAt ?? candidate.startedAt,
        upstream: health.upstream,
        source: candidate.source
      };
    })
  );
  return probed.filter(Boolean).sort(compareTargets);
}
function toPublic(target) {
  return {
    origin: target.origin,
    lane: target.lane,
    version: target.version,
    pid: target.pid,
    startedAt: target.startedAt
  };
}
function pathDirs() {
  const fromEnv = (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  return [
    .../* @__PURE__ */ new Set([
      ...fromEnv,
      path.join(HOME, ".local", "bin"),
      "/opt/homebrew/bin",
      "/usr/local/bin",
      path.join(HOME, ".bun", "bin")
    ])
  ];
}
async function isFile(file) {
  try {
    return (await fsp.stat(file)).isFile();
  } catch {
    return false;
  }
}
function findNode() {
  for (const dir of pathDirs()) {
    const candidate = path.join(dir, "node");
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
    }
  }
  return null;
}
async function findBiliCli() {
  const fromPath = pathDirs().map((dir) => path.join(dir, "bili"));
  const knownScripts = [
    path.join(HOME, ".local", "lib", "node_modules", "billion-context", "dist", "index.js"),
    path.join(HOME, ".pi", "agent", "npm", "node_modules", "billion-context", "dist", "index.js"),
    path.join(HOME, ".dsh", "profiles", "tauri", "node_modules", "billion-context", "dist", "index.js"),
    "/opt/homebrew/lib/node_modules/billion-context/dist/index.js",
    "/usr/local/lib/node_modules/billion-context/dist/index.js"
  ];
  let script = null;
  for (const entry of [...fromPath, path.join(HOME, ".local", "bin", "bili"), path.join(HOME, ".bun", "bin", "bili")]) {
    if (!await isFile(entry)) continue;
    let real = entry;
    try {
      real = fs.realpathSync(entry);
    } catch {
    }
    if (real.endsWith(".js") || real.endsWith(".mjs")) {
      script = real;
      break;
    }
    try {
      fs.accessSync(real, fs.constants.X_OK);
      return { command: real, args: ["start"], env: { ...process.env } };
    } catch {
    }
  }
  if (!script) {
    for (const candidate of knownScripts) {
      if (await isFile(candidate)) {
        try {
          script = fs.realpathSync(candidate);
        } catch {
          script = candidate;
        }
        break;
      }
    }
  }
  if (!script) return null;
  const node = findNode();
  if (node) return { command: node, args: [script, "start"], env: { ...process.env } };
  return {
    command: process.execPath,
    args: [script, "start"],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }
  };
}
var starting = null;
function startProxy() {
  if (starting) return starting;
  starting = (async () => {
    const already = await collectTargets();
    if (already.length) return { ok: true, started: false, targets: already.map(toPublic) };
    const cli = await findBiliCli();
    if (!cli) return { ok: false, error: "no-cli", targets: [] };
    let child;
    try {
      child = spawn(cli.command, cli.args, {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
        cwd: HOME,
        env: cli.env
      });
      child.unref();
    } catch (error) {
      return { ok: false, error: "spawn-failed", detail: String(error && error.message || error), targets: [] };
    }
    let exited = null;
    child.once("exit", (code, signal) => {
      exited = signal ? `signal ${signal}` : `exit ${code}`;
    });
    child.once("error", (error) => {
      exited = String(error && error.message || error);
    });
    const deadline = Date.now() + START_WAIT_MS;
    while (Date.now() < deadline) {
      await sleep(START_POLL_MS);
      const targets = await collectTargets();
      if (targets.length) return { ok: true, started: true, targets: targets.map(toPublic) };
      if (exited) break;
    }
    return {
      ok: false,
      error: exited ? "exited" : "timeout",
      detail: exited || void 0,
      targets: (await collectTargets()).map(toPublic)
    };
  })().finally(() => {
    starting = null;
  });
  return starting;
}
var server = http.createServer(async (req, res) => {
  try {
    if (!TOKEN || req.headers.authorization !== `Bearer ${TOKEN}`) {
      return send(res, 401, { ok: false, error: "unauthorized" });
    }
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const route = url.pathname;
    if (req.method === "GET" && route === "/health") {
      return send(res, 200, { ok: true, pid: process.pid });
    }
    if (req.method === "GET" && route === "/targets") {
      const targets = (await collectTargets()).map(toPublic);
      return send(res, 200, { ok: true, targets });
    }
    if (req.method === "POST" && route === "/start") {
      return send(res, 200, await startProxy());
    }
    return send(res, 404, { ok: false, error: "not-found" });
  } catch (error) {
    return send(res, 500, { ok: false, error: "internal", detail: String(error && error.message || error) });
  }
});
server.on("error", (error) => {
  console.error("[bili-webui] server error:", error);
  process.exit(1);
});
function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
server.listen(PORT, "127.0.0.1", () => {
  console.log(`[bili-webui] listening on 127.0.0.1:${PORT}`);
});
