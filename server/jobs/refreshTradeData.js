import { fileURLToPath } from "node:url";
import path from "node:path";
import { productConfigs } from "../config.js";
import { fetchMonthlyProductSeries, fetchMonthlyProductSeriesFromTradeDataWeb } from "../koreaTradeClient.js";
import { readStore, writeStore } from "../storage.js";

function latestMonthlyPeriod(points) {
  return points.map((point) => point.period).filter(Boolean).sort().at(-1);
}

function periodToZh(period) {
  const [year, month] = String(period).split(".");
  if (!year || !month) return period;
  return `${year}年${Number(month)}月`;
}

function addMonths(period, months) {
  const [year, month] = String(period).split(".").map(Number);
  if (!year || !month) return null;
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  return `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月`;
}

function nextExpectedMonthlyHsDate(period) {
  const nextDataMonth = addMonths(period, 1);
  const releaseMonth = addMonths(period, 2);
  if (!nextDataMonth || !releaseMonth) return null;
  return `${nextDataMonth}最终值预计 ${releaseMonth}中旬随 KCS/data.go.kr/TRASS 更新`;
}

function updateMonthlyHsMetadata(store, latestPeriod, source) {
  const latestZh = periodToZh(latestPeriod);
  const nextExpected = nextExpectedMonthlyHsDate(latestPeriod);
  const freshness = store.freshness?.find((item) => item.key === "monthly_hs");
  if (freshness) {
    freshness.latestPeriod = latestZh;
    freshness.latestReleaseDate =
      source === "official_api"
        ? `KCS/data.go.kr 官方接口已更新至 ${latestPeriod}`
        : `KCS TradeData 官方网页已更新至 ${latestPeriod}`;
    freshness.nextExpectedDate = nextExpected ?? freshness.nextExpectedDate;
    freshness.status = source === "official_api" ? "official_api" : "official_public_web";
    freshness.note =
      "Chrome/网页接口可访问 KCS TradeData 英文 By H.S Code 页面，并取得月度出口金额和 KG。SSD 使用 HS 852351（Solid-state non-volatile storage devices）；DRAM/HBM 使用 HS 854232（Memories）。";
  }

  for (const item of store.sourceRegistry ?? []) {
    if (item.section === "monthly_hs" && item.sourceName === "KCS TradeData English by H.S Code monthly statistics") {
      item.note = `Browser-visible official KCS page provides monthly HS export value in thousand USD and export weight in KG through its same-site query. Verified through ${latestPeriod} for SSD HS 852351 and DRAM/HBM proxy HS 854232.`;
    }
    if (item.section === "monthly_hs" && item.sourceName === "KCS/data.go.kr Itemtrade API") {
      item.note =
        source === "official_api"
          ? `Official API source refreshed monthly HS export value and net weight through ${latestPeriod}.`
          : `Official API source for monthly HS export value and net weight. DATA_GO_KR_SERVICE_KEY was not present or not used; KCS TradeData web query refreshed rows through ${latestPeriod}.`;
    }
  }
}

async function fetchMonthlyResponsesFromApi() {
  const monthly = await Promise.all(productConfigs.map((product) => fetchMonthlyProductSeries(product)));
  return {
    monthly: monthly.flat(),
    mode: "official_api",
    source: "official_api",
    message: "已通过 KCS/data.go.kr 官方接口更新月度 HS 品类出口金额、净重与单位价格。"
  };
}

async function fetchMonthlyResponsesFromTradeDataWeb(reason) {
  const monthly = await Promise.all(productConfigs.map((product) => fetchMonthlyProductSeriesFromTradeDataWeb(product)));
  return {
    monthly: monthly.flat(),
    mode: "mixed_public",
    source: "official_tradedata_web",
    message: `已通过 KCS TradeData 官方网页接口更新月度 HS 品类出口金额、净重与单位价格。${reason}`
  };
}

export async function refreshTradeData() {
  const base = await readStore();

  try {
    let refresh;
    if (process.env.DATA_GO_KR_SERVICE_KEY) {
      try {
        refresh = await fetchMonthlyResponsesFromApi();
      } catch (apiError) {
        refresh = await fetchMonthlyResponsesFromTradeDataWeb(
          `DATA_GO_KR_SERVICE_KEY 已配置但 API 拉取失败，已回退网页接口：${apiError instanceof Error ? apiError.message : "unknown error"}`
        );
      }
    } else {
      refresh = await fetchMonthlyResponsesFromTradeDataWeb("当前未配置 DATA_GO_KR_SERVICE_KEY。");
    }

    const latestPeriod = latestMonthlyPeriod(refresh.monthly);
    const store = {
      ...base,
      meta: {
        ...base.meta,
        lastUpdated: new Date().toISOString(),
        nextScheduledUpdate: null,
        mode: refresh.mode,
        message: refresh.message
      },
      products: productConfigs,
      monthly: refresh.monthly
    };
    updateMonthlyHsMetadata(store, latestPeriod, refresh.source);
    await writeStore(store);
    return store;
  } catch (error) {
    base.meta = {
      ...base.meta,
      message: `官方接口拉取失败，保留最近一次已核验数据：${error instanceof Error ? error.message : "unknown error"}`
    };
    await writeStore(base);
    return base;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  refreshTradeData()
    .then((store) => {
      console.log(`[refresh] ${store.meta.mode}: ${store.monthly.length} monthly points`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
