import { env } from "./config.js";

function toNumber(value) {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return value;
  return Number(String(value).replaceAll(",", "")) || 0;
}

function monthToken(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function getLookbackRange(lookbackMonths) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const start = new Date(end.getFullYear(), end.getMonth() - lookbackMonths + 1, 1);
  return { start: monthToken(start), end: monthToken(end) };
}

function tagValue(block, tagName) {
  const match = block.match(new RegExp(`<${tagName}>(.*?)</${tagName}>`, "s"));
  return match ? match[1].trim() : "";
}

function parseXmlItems(xml) {
  return [...xml.matchAll(/<item>(.*?)<\/item>/gs)].map((match) => ({
    year: tagValue(match[1], "year"),
    hsCd: tagValue(match[1], "hsCd"),
    statKor: tagValue(match[1], "statKor"),
    expWgt: tagValue(match[1], "expWgt"),
    expDlr: tagValue(match[1], "expDlr")
  }));
}

function unwrapJsonItems(json) {
  const item = json?.response?.body?.items?.item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

const tradeDataWeb = {
  pageUrl: "https://www.tradedata.go.kr/cts/hmpgEng/openETS0200013Q.do?menuId=ETS_MNE_10200000",
  queryUrl: "https://www.tradedata.go.kr/cts/hmpgEng/retrieveTradeHsCodeEng.do",
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
};

function cookieHeader(setCookie) {
  if (!setCookie) return "";
  return setCookie
    .split(/,(?=[^ ;]+=)/)
    .map((item) => item.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

function parseTradeDataWebItems(json) {
  return (json?.items ?? []).filter((item) => item.priodTitle && item.priodTitle !== "TOTAL");
}

export async function fetchMonthlyProductSeries(product, range = getLookbackRange(env.lookbackMonths)) {
  if (!env.serviceKey) {
    throw new Error("DATA_GO_KR_SERVICE_KEY is not configured.");
  }

  const endpoint = "http://apis.data.go.kr/1220000/Itemtrade/getItemtradeList";
  const params = new URLSearchParams({
    strtYymm: range.start,
    endYymm: range.end,
    hsSgn: product.hsCode,
    numOfRows: "200",
    _type: "json"
  });
  const response = await fetch(`${endpoint}?serviceKey=${env.serviceKey}&${params.toString()}`);
  if (!response.ok) {
    throw new Error(`KCS itemtrade request failed: ${response.status} ${response.statusText}`);
  }

  const raw = await response.text();
  let items = [];
  try {
    const parsed = JSON.parse(raw);
    const resultCode = String(parsed?.response?.header?.resultCode ?? "");
    if (resultCode && resultCode !== "00") {
      throw new Error(`${resultCode}: ${parsed?.response?.header?.resultMsg ?? "unknown error"}`);
    }
    items = unwrapJsonItems(parsed);
  } catch (jsonError) {
    if (!raw.trim().startsWith("<")) throw jsonError;
    items = parseXmlItems(raw);
  }

  return items
    .map((item) => {
      const valueUsd = toNumber(item.expDlr);
      const weightKg = toNumber(item.expWgt);
      const period = String(item.year ?? "");
      return {
        period,
        periodLabel: period.replace(".", "-"),
        valueUsd,
        weightKg,
        unitPriceUsdPerKg: weightKg > 0 ? valueUsd / weightKg : null,
        hsCode: String(item.hsCd ?? product.hsCode),
        productKey: product.key,
        productName: product.name,
        source: "official_api",
        status: "final"
      };
    })
    .filter((point) => point.period && point.valueUsd > 0)
    .sort((a, b) => a.period.localeCompare(b.period));
}

export async function fetchMonthlyProductSeriesFromTradeDataWeb(product, range = getLookbackRange(env.lookbackMonths)) {
  const pageResponse = await fetch(tradeDataWeb.pageUrl, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": tradeDataWeb.userAgent
    }
  });
  if (!pageResponse.ok) {
    throw new Error(`KCS TradeData page request failed: ${pageResponse.status} ${pageResponse.statusText}`);
  }
  await pageResponse.text();

  const params = new URLSearchParams({
    priodKind: "MON",
    priodFr: range.start,
    priodTo: range.end,
    langTpcd: "ENG",
    ttwgTpcd: "1",
    selectPaging: "1",
    showPagingLine: "100",
    sortColumn: "",
    sortOrder: "",
    hsSgnGrpCol: "HS6_SGN",
    hsSgnWhrCol: "HS6_SGN",
    hsSgn: product.hsCode,
    subHsSgn: "N"
  });
  const response = await fetch(tradeDataWeb.queryUrl, {
    method: "POST",
    headers: {
      accept: "application/json, text/javascript, */*; q=0.01",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "x-requested-with": "XMLHttpRequest",
      origin: "https://www.tradedata.go.kr",
      referer: tradeDataWeb.pageUrl,
      "user-agent": tradeDataWeb.userAgent,
      cookie: cookieHeader(pageResponse.headers.get("set-cookie"))
    },
    body: params
  });
  if (!response.ok) {
    throw new Error(`KCS TradeData web query failed: ${response.status} ${response.statusText}`);
  }

  const parsed = await response.json();
  return parseTradeDataWebItems(parsed)
    .map((item) => {
      const valueUsd = toNumber(item.expUsdAmt) * 1000;
      const weightKg = toNumber(item.expTtwg);
      const period = String(item.priodTitle ?? "");
      return {
        period,
        periodLabel: period.replace(".", "-"),
        valueUsd,
        weightKg,
        unitPriceUsdPerKg: weightKg > 0 ? valueUsd / weightKg : null,
        hsCode: String(item.hsSgn ?? product.hsCode),
        productKey: product.key,
        productName: product.name,
        source: "official_tradedata_web",
        sourceName: "KCS TradeData English by H.S Code monthly statistics",
        sourceUrl: tradeDataWeb.pageUrl,
        status: "final"
      };
    })
    .filter((point) => point.period && point.valueUsd > 0)
    .sort((a, b) => a.period.localeCompare(b.period));
}
