const TAIWAN_DATASET_URL = "https://data.gov.tw/en/datasets/28555";
const TAIWAN_METADATA_URL = "https://data.gov.tw/api/v2/rest/dataset/28555";
const TAIWAN_CSV_URL =
  "https://web02.mof.gov.tw/njswww/webMain.aspx?sys=220&ym=9000&kind=21&type=4&funid=op8202&cycle=41&outmode=12&compmode=00&outkind=12&fld4=1&codspc0=0,20,&utf=1";
const JAPAN_ESTAT_ORIGIN = "https://www.e-stat.go.jp";
const JAPAN_DATASET_URL =
  "https://www.e-stat.go.jp/en/stat-search/files?cycle=1&cycle_facet=cycle&data=1&layout=datalist&metadata=1&page=1&tclass1=000001013180&tclass2=000001013181&tclass3val=0&toukei=00350300&tstat=000001013141";

function parseCsvLine(line) {
  const fields = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      fields.push(field.trim());
      field = "";
    } else {
      field += char;
    }
  }
  fields.push(field.trim());
  return fields;
}

function csvRows(csv) {
  return String(csv)
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map(parseCsvLine);
}

function numeric(value) {
  const normalized = String(value ?? "").replaceAll(",", "").trim();
  if (!normalized || normalized === "－" || normalized === "-") return 0;
  const result = Number(normalized);
  return Number.isFinite(result) ? result : 0;
}

export function resolveTaiwanCsvUrl(metadata) {
  const resourceUrl = metadata?.result?.distribution?.find((item) => item?.resourceDownloadUrl)?.resourceDownloadUrl;
  return resourceUrl || TAIWAN_CSV_URL;
}

export function parseTaiwanMofCsv(csv) {
  const [header, ...rows] = csvRows(csv);
  const periodIndex = header?.findIndex((value) => value === "國家/地區別") ?? -1;
  const totalIndex = header?.findIndex((value) => value.startsWith("總計")) ?? -1;
  const electricalIndex = header?.findIndex((value) => value.startsWith("16.機械及電機設備")) ?? -1;
  if (periodIndex < 0 || totalIndex < 0 || electricalIndex < 0) {
    throw new Error("Taiwan MOF CSV columns changed");
  }

  return rows
    .map((row) => {
      const match = row[periodIndex]?.match(/^(\d{2,3})年\s*(\d{1,2})月$/);
      if (!match) return null;
      const year = Number(match[1]) + 1911;
      const month = String(Number(match[2])).padStart(2, "0");
      return {
        period: `${year}.${month}`,
        totalImportUsd: numeric(row[totalIndex]) * 1_000,
        valueUsd: numeric(row[electricalIndex]) * 1_000
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.period.localeCompare(b.period));
}

function decodeHtmlUrl(value) {
  return String(value).replaceAll("&amp;", "&");
}

export function discoverLatestJapanDatasetUrl(html) {
  const match = String(html).match(/href="([^"]*year=\d+0[^"]*month=\d+[^"]*result_back=1[^"]*)"[^>]*>[^<]+<\/a>/i);
  if (!match) throw new Error("Could not find the latest Japan e-Stat monthly dataset");
  return new URL(decodeHtmlUrl(match[1]), JAPAN_ESTAT_ORIGIN).toString();
}

export function discoverJapanSectionCsvUrl(html) {
  const match = String(html).match(
    /Section XVI Chapter 84-85[\s\S]{0,2500}?href="([^"]*file-download\?statInfId=\d+&(?:amp;)?fileKind=1)"/i
  );
  if (!match) throw new Error("Could not find Japan e-Stat Section XVI Chapter 84-85 CSV");
  return new URL(decodeHtmlUrl(match[1]), JAPAN_ESTAT_ORIGIN).toString();
}

export function parseJapanSsdCsv(csv) {
  const [header, ...rows] = csvRows(csv);
  const hsIndex = header?.indexOf("HS") ?? -1;
  const countryIndex = header?.indexOf("Country") ?? -1;
  const yearIndex = header?.indexOf("Year") ?? -1;
  const directionIndex = header?.indexOf("Exp or Imp") ?? -1;
  if (hsIndex < 0 || countryIndex < 0 || yearIndex < 0 || directionIndex < 0) {
    throw new Error("Japan e-Stat CSV columns changed");
  }
  const row = rows.find(
    (candidate) =>
      candidate[directionIndex] === "1" &&
      candidate[hsIndex]?.replaceAll("'", "") === "852351000" &&
      candidate[countryIndex] === "106"
  );
  if (!row) throw new Error("Japan e-Stat CSV has no HS 852351000 row for Taiwan country 106");

  const year = Number(row[yearIndex]);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months
    .map((month, index) => {
      const quantityIndex = header.indexOf(`Quantity2-${month}`);
      const valueIndex = header.indexOf(`Value-${month}`);
      const quantityUnits = numeric(row[quantityIndex]);
      const valueJpy = numeric(row[valueIndex]) * 1_000;
      if (!quantityUnits && !valueJpy) return null;
      return {
        period: `${year}.${String(index + 1).padStart(2, "0")}`,
        quantityUnits,
        valueJpy
      };
    })
    .filter(Boolean);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "memory-export-tracker/1.0 (+https://memory-export.chenzixin.uk)" },
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.text();
}

function koreaPoint(point) {
  return {
    ...point,
    periodLabel: point.period.replace(".", "-"),
    routeKey: "korea_to_taiwan_electrical",
    reporter: "Taiwan import customs",
    origin: "South Korea",
    destination: "Taiwan",
    productName: "Machinery & electrical equipment imports from South Korea",
    productLabel: "韩国→台湾 机械及电机设备",
    source: "taiwan_mof_open_data",
    sourceName: "Taiwan MOF open data: Imported from South Korea - by main goods",
    sourceUrl: TAIWAN_DATASET_URL,
    unit: "USD"
  };
}

function japanPoint(point, sourceUrl) {
  return {
    ...point,
    periodLabel: point.period.replace(".", "-"),
    unitValueJpyPerUnit: point.quantityUnits ? point.valueJpy / point.quantityUnits : null,
    routeKey: "japan_to_taiwan_ssd",
    reporter: "Japan export customs",
    origin: "Japan",
    destination: "Taiwan",
    hsCode: "852351000",
    productName: "Solid-state non-volatile storage devices",
    productLabel: "日本→台湾 SSD",
    source: "japan_mof_estat",
    sourceName: "Japan MOF e-Stat: Commodity by Country Export, HS 852351000, country 106 Taiwan",
    sourceUrl,
    unit: "JPY"
  };
}

function mergeRoutePoints(existing, routeKey, incoming) {
  const points = new Map(
    existing.filter((point) => point.routeKey === routeKey).map((point) => [point.period, point])
  );
  for (const point of incoming) points.set(point.period, point);
  return [...points.values()].sort((a, b) => a.period.localeCompare(b.period));
}

export async function refreshTaiwanDemand(existing) {
  const current = existing ?? { meta: {}, routes: [], monthly: [] };
  const results = await Promise.allSettled([
    fetchText(TAIWAN_METADATA_URL)
      .then(JSON.parse)
      .then(resolveTaiwanCsvUrl)
      .catch(() => TAIWAN_CSV_URL)
      .then(fetchText)
      .then(parseTaiwanMofCsv),
    fetchText(JAPAN_DATASET_URL)
      .then(discoverLatestJapanDatasetUrl)
      .then(fetchText)
      .then((html) => ({ csvUrl: discoverJapanSectionCsvUrl(html) }))
      .then(async ({ csvUrl }) => ({ csvUrl, points: parseJapanSsdCsv(await fetchText(csvUrl)) }))
  ]);

  const existingMonthly = current.monthly ?? [];
  const earliestKorea = existingMonthly.find((point) => point.routeKey === "korea_to_taiwan_electrical")?.period;
  const koreaIncoming =
    results[0].status === "fulfilled"
      ? results[0].value.filter((point) => !earliestKorea || point.period >= earliestKorea).map(koreaPoint)
      : [];
  const japanIncoming =
    results[1].status === "fulfilled"
      ? results[1].value.points.map((point) => japanPoint(point, results[1].value.csvUrl))
      : [];
  const monthly = [
    ...mergeRoutePoints(existingMonthly, "japan_to_taiwan_ssd", japanIncoming),
    ...mergeRoutePoints(existingMonthly, "korea_to_taiwan_electrical", koreaIncoming)
  ];
  const routeLatestPeriods = Object.fromEntries(
    (current.routes ?? []).map((route) => [
      route.key,
      monthly.filter((point) => point.routeKey === route.key).map((point) => point.period).sort().at(-1) ?? null
    ])
  );
  const failures = results
    .map((result, index) =>
      result.status === "rejected"
        ? `${index === 0 ? "Taiwan MOF" : "Japan e-Stat"}: ${result.reason instanceof Error ? result.reason.message : result.reason}`
        : null
    )
    .filter(Boolean);

  return {
    ...current,
    meta: {
      ...current.meta,
      lastVerifiedAt: new Date().toISOString(),
      routeLatestPeriods,
      refreshStatus: failures.length ? "partial" : "ok",
      refreshFailures: failures,
      notes: [
        `韩国→台湾使用台湾财政部开放数据，自动更新至 ${routeLatestPeriods.korea_to_taiwan_electrical ?? "--"}。该第16类口径是供应链代理，不等同于单一存储芯片 HS。`,
        `日本→台湾 SSD 使用日本财务省 e-Stat 的 HS 852351000、目的地代码 106，自动更新至 ${routeLatestPeriods.japan_to_taiwan_ssd ?? "--"}。`
      ]
    },
    monthly
  };
}
