const DEFAULT_RANGE = 12;

export const dataApiCatalog = [
  {
    path: "/api/data/overview",
    description: "Latest dashboard metadata, latest monthly product points, provisional memory detail, and Taiwan-route latest points."
  },
  {
    path: "/api/data/monthly?product=dram_hbm&range=12",
    description: "Monthly HS series. product can be ssd, dram_hbm, or all. range can be a month count or all."
  },
  {
    path: "/api/data/memory-detail?category=DRAM%20incl.%20modules",
    description: "Provisional memory detail rows, including DRAM, SSD, NAND, and MCP/HBM proxy where available."
  },
  {
    path: "/api/data/taiwan-routes?route=korea_to_taiwan_electrical",
    description: "Taiwan-side proxy and auxiliary routes currently available in the dashboard."
  },
  {
    path: "/api/data/sources",
    description: "Source registry and freshness notes for official, provisional, proxy, and derived data."
  },
  {
    path: "/mcp",
    description: "Remote MCP endpoint exposing the same read-only data through tools."
  }
];

export function buildOverview(store) {
  const monthlyByProduct = Object.fromEntries(
    (store.products || []).map((product) => [product.key, latestForProduct(store.monthly || [], product.key)])
  );
  const taiwanLatest = Object.fromEntries(
    (store.taiwanDemand?.routes || []).map((route) => [route.key, latestForRoute(store.taiwanDemand?.monthly || [], route.key)])
  );

  return {
    meta: store.meta,
    products: store.products || [],
    latestMonthly: monthlyByProduct,
    latestMemoryDetail: store.memoryDetail || [],
    latestTaiwanRoutes: taiwanLatest,
    freshness: store.freshness || [],
    api: dataApiCatalog
  };
}

export function buildMonthlySeries(store, options = {}) {
  const product = normalizeProduct(options.product ?? options.productKey);
  const range = normalizeRange(options.range);
  const rows = (store.monthly || [])
    .filter((point) => product === "all" || point.productKey === product)
    .sort((a, b) => String(a.period).localeCompare(String(b.period)));

  const grouped = groupBy(rows, (point) => point.productKey || "unknown");
  return Object.fromEntries(
    Object.entries(grouped).map(([productKey, points]) => [
      productKey,
      {
        product: (store.products || []).find((item) => item.key === productKey) || null,
        points: range === "all" ? points : points.slice(-range)
      }
    ])
  );
}

export function buildMemoryDetail(store, options = {}) {
  const category = options.category ? String(options.category).toLowerCase() : null;
  const rows = (store.memoryDetail || []).filter((point) => {
    if (!category || category === "all") return true;
    return String(point.category || "").toLowerCase().includes(category);
  });
  return {
    rows,
    freshness: findFreshness(store, "memory_provisional_detail"),
    caveat: "Provisional split rows are market-repost or derived data unless source/status states otherwise."
  };
}

export function buildTaiwanRoutes(store, options = {}) {
  const routeKey = options.route ?? options.routeKey;
  const routes = (store.taiwanDemand?.routes || []).filter((route) => !routeKey || route.key === routeKey);
  const monthly = (store.taiwanDemand?.monthly || []).filter((point) => !routeKey || point.routeKey === routeKey);
  return {
    meta: store.taiwanDemand?.meta || null,
    routes,
    monthly,
    caveat: "Current Taiwan-side rows include proxy and auxiliary routes. Taiwan CCC 85423200234 and 84715000003 are called out in the UI as target routes but are not yet continuous time series in this dataset."
  };
}

export function buildSources(store) {
  return {
    freshness: store.freshness || [],
    sourceRegistry: store.sourceRegistry || [],
    products: (store.products || []).map((product) => ({
      key: product.key,
      name: product.name,
      hsCode: product.hsCode,
      note: product.note
    }))
  };
}

export function handleDataApi(pathname, searchParams, store) {
  if (pathname === "/api/data" || pathname === "/api/data/catalog") {
    return { ok: true, data: { endpoints: dataApiCatalog } };
  }
  if (pathname === "/api/data/overview") {
    return { ok: true, data: buildOverview(store) };
  }
  if (pathname === "/api/data/monthly") {
    return {
      ok: true,
      data: buildMonthlySeries(store, {
        product: searchParams.get("product") || "all",
        range: searchParams.get("range") || DEFAULT_RANGE
      })
    };
  }
  if (pathname === "/api/data/memory-detail") {
    return { ok: true, data: buildMemoryDetail(store, { category: searchParams.get("category") || "all" }) };
  }
  if (pathname === "/api/data/taiwan-routes") {
    return { ok: true, data: buildTaiwanRoutes(store, { route: searchParams.get("route") || null }) };
  }
  if (pathname === "/api/data/sources") {
    return { ok: true, data: buildSources(store) };
  }
  return null;
}

function latestForProduct(monthly, productKey) {
  return monthly
    .filter((point) => point.productKey === productKey)
    .sort((a, b) => String(a.period).localeCompare(String(b.period)))
    .at(-1) || null;
}

function latestForRoute(monthly, routeKey) {
  return monthly
    .filter((point) => point.routeKey === routeKey)
    .sort((a, b) => String(a.period).localeCompare(String(b.period)))
    .at(-1) || null;
}

function findFreshness(store, key) {
  return (store.freshness || []).find((item) => item.key === key) || null;
}

function groupBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

function normalizeProduct(product) {
  if (!product || product === "all") return "all";
  const normalized = String(product).toLowerCase();
  if (["ssd", "dram_hbm"].includes(normalized)) return normalized;
  return "all";
}

function normalizeRange(range) {
  if (!range || range === "all") return "all";
  const number = Number(range);
  if (!Number.isFinite(number) || number <= 0) return DEFAULT_RANGE;
  return Math.min(Math.trunc(number), 120);
}
