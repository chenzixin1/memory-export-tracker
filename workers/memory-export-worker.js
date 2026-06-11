import { handleDataApi } from "../shared/data-api.js";
import { serveMemoryExportMcp } from "./mcp-server.js";

const DATA_KEY = "trade-data/latest.json";
const STATUS_KEY = "trade-data/status.json";
const HISTORY_PREFIX = "trade-data/history/";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return corsResponse(null, 204);
    }

    if (url.pathname === "/api/dashboard" || url.pathname === "/data/trade-data.json") {
      return serveTradeData(request, env);
    }

    if (url.pathname === "/mcp") {
      return serveMemoryExportMcp(request, env, ctx, () => readTradeDataPayload(request, env));
    }

    if (url.pathname === "/api/data" || url.pathname.startsWith("/api/data/")) {
      const payload = await readTradeDataPayload(request, env);
      const result = handleDataApi(url.pathname, url.searchParams, payload);
      if (!result) return json({ error: "Unknown data API endpoint.", catalogUrl: "/api/data/catalog" }, 404);
      return json(result.data);
    }

    if (url.pathname === "/api/memory-export-update/status") {
      return serveStatus(env);
    }

    if (url.pathname === "/api/memory-export-update/run") {
      if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);
      const dispatched = await dispatchWorkflow(env, { reason: "manual" });
      await writeStatus(env, dispatched);
      return json(dispatched, dispatched.ok ? 202 : 502);
    }

    if (url.pathname === "/api/memory-export-update/publish") {
      if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);
      if (request.method !== "POST") return json({ error: "POST required" }, 405);
      const published = await publishTradeData(request, env);
      await writeStatus(env, published);
      return json(published, published.ok ? 200 : 400);
    }

    if (url.pathname === "/api/refresh") {
      if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);
      const dispatched = await dispatchWorkflow(env, { reason: "manual-refresh" });
      await writeStatus(env, dispatched);
      return json(dispatched, dispatched.ok ? 202 : 502);
    }

    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(dispatchWorkflow(env, { reason: "cron", cron: event.cron }).then((status) => writeStatus(env, status)));
  }
};

async function serveTradeData(request, env) {
  const body = await readTradeDataBody(request, env);
  if (body) return dataResponse(body);

  return json(
    {
      error: "Trade data has not been published yet.",
      statusUrl: "/api/memory-export-update/status"
    },
    503
  );
}

async function readTradeDataPayload(request, env) {
  const body = await readTradeDataBody(request, env);
  if (!body) {
    throw new Error("Trade data has not been published yet.");
  }
  return JSON.parse(body);
}

async function readTradeDataBody(request, env) {
  const body = await env.MEMORY_EXPORT_KV.get(DATA_KEY);
  if (body) return body;

  const assetUrl = new URL("/data/trade-data.json", request.url);
  const fallback = await env.ASSETS.fetch(new Request(assetUrl.toString(), { method: "GET" }));
  if (fallback.ok) {
    return await fallback.text();
  }

  return null;
}

async function serveStatus(env) {
  const body = await env.MEMORY_EXPORT_KV.get(STATUS_KEY);
  if (!body) {
    return json({
      ok: false,
      message: "No Worker update has completed yet.",
      generatedAt: new Date().toISOString()
    });
  }
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*"
    }
  });
}

async function dispatchWorkflow(env, context = {}) {
  const owner = env.GITHUB_OWNER || "chenzixin1";
  const repo = env.GITHUB_REPO || "memory-export-tracker";
  const workflowId = env.GITHUB_WORKFLOW_ID || "update-memory-export-kv.yml";
  const ref = env.GITHUB_REF || "codex/regimealpha-cloudflare-redesign";
  const startedAt = new Date().toISOString();

  if (!env.GITHUB_DISPATCH_TOKEN) {
    return {
      ok: false,
      phase: "dispatch",
      error: "GITHUB_DISPATCH_TOKEN is not configured.",
      startedAt
    };
  }

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      "user-agent": "memory-export-tracker-worker"
    },
    body: JSON.stringify({
      ref,
      inputs: {
        reason: context.reason || "worker"
      }
    })
  });

  const status = {
    ok: response.status === 204,
    phase: "dispatch",
    reason: context.reason || "unknown",
    cron: context.cron || null,
    workflow: workflowId,
    githubStatus: response.status,
    startedAt,
    finishedAt: new Date().toISOString()
  };
  if (!status.ok) status.error = await response.text();
  return status;
}

async function publishTradeData(request, env) {
  const startedAt = new Date().toISOString();
  const body = await request.text();
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return failPublish(startedAt, "Request body is not valid JSON.");
  }

  if (!payload?.meta || !Array.isArray(payload?.products) || !Array.isArray(payload?.monthly)) {
    return failPublish(startedAt, "Payload does not look like memory export dashboard data.");
  }

  const dataThrough = inferDataThrough(payload);
  if (!dataThrough) {
    return failPublish(startedAt, "Unable to infer dataThrough from payload.");
  }

  const normalized = `${JSON.stringify(payload, null, 2)}\n`;
  await env.MEMORY_EXPORT_KV.put(DATA_KEY, normalized, {
    metadata: {
      dataThrough,
      mode: payload.meta.mode,
      lastUpdated: payload.meta.lastUpdated
    }
  });
  await env.MEMORY_EXPORT_KV.put(`${HISTORY_PREFIX}${dataThrough}.json`, normalized, {
    metadata: {
      mode: payload.meta.mode,
      lastUpdated: payload.meta.lastUpdated
    }
  });

  return {
    ok: true,
    phase: "publish",
    startedAt,
    finishedAt: new Date().toISOString(),
    dataThrough,
    mode: payload.meta.mode,
    bytes: normalized.length,
    monthlyPoints: payload.monthly.length,
    products: payload.products.map((product) => product.key)
  };
}

function inferDataThrough(payload) {
  const monthlyPeriods = payload.monthly.map((point) => point.period).filter(Boolean).sort();
  const latestMonthly = monthlyPeriods.at(-1);
  const latestPrelim = (payload.preliminary || []).map((point) => point.period).filter(Boolean).sort().at(-1);
  return latestPrelim || latestMonthly || payload.meta.lastUpdated?.slice(0, 10);
}

function failPublish(startedAt, error) {
  return {
    ok: false,
    phase: "publish",
    startedAt,
    finishedAt: new Date().toISOString(),
    error
  };
}

async function writeStatus(env, status) {
  if (status.phase === "dispatch") {
    const current = await readStatusPayload(env);
    if (current?.phase === "publish" && current.startedAt && current.startedAt >= status.startedAt) return;
  }
  await env.MEMORY_EXPORT_KV.put(STATUS_KEY, `${JSON.stringify(status, null, 2)}\n`);
}

async function readStatusPayload(env) {
  try {
    const body = await env.MEMORY_EXPORT_KV.get(STATUS_KEY);
    return body ? JSON.parse(body) : null;
  } catch {
    return null;
  }
}

function isAuthorized(request, env) {
  if (!env.UPDATE_TOKEN) return false;
  const url = new URL(request.url);
  const header = request.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  return bearer === env.UPDATE_TOKEN || url.searchParams.get("token") === env.UPDATE_TOKEN;
}

function dataResponse(body) {
  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300, stale-while-revalidate=3600",
      "access-control-allow-origin": "*"
    }
  });
}

function json(payload, status = 200) {
  return corsResponse(JSON.stringify(payload, null, 2), status, "application/json; charset=utf-8");
}

function corsResponse(body, status, contentType = "text/plain; charset=utf-8") {
  return new Response(body, {
    status,
    headers: {
      "content-type": contentType,
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "authorization, content-type"
    }
  });
}
