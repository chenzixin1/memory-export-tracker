import { fileURLToPath } from "node:url";
import path from "node:path";
import { productConfigs } from "../config.js";
import { fetchMonthlyProductSeries, fetchMonthlyProductSeriesFromTradeDataWeb } from "../koreaTradeClient.js";
import { readStore, writeStore, writeTaiwanDemand } from "../storage.js";
import { refreshTaiwanDemand } from "../taiwanDemandClient.js";

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

function updateMonthlySemiconductorMetadata(store) {
  const freshness = store.freshness?.find((item) => item.key === "monthly_semiconductor");
  if (freshness?.latestPeriod === "2026年5月") {
    freshness.latestReleaseDate = "2026-06-15";
    freshness.status = "official_public_final";
    freshness.note =
      "KCS 主站已在 2026-06-15 挂出《2026년 5월 월간 수출입 현황 [확정치]》。5 月半导体出口约 371.6 亿美元，同比 +169.4%；5 月总出口约 877.5 亿美元，同比 +53.2%。";
  }

  for (const item of store.sourceRegistry ?? []) {
    if (item.key === "motie_kcs_202605_monthly") {
      item.status = "official_public_crosschecked";
      item.sourceName = "MOTIE/KCS May 2026 Export-Import Trends, crosschecked with KCS final monthly bulletin list";
      item.sourceUrl = "https://eiec.kdi.re.kr/policy/materialView.do?num=281941";
      item.officialListUrl = "https://www.customs.go.kr/kcs/na/ntt/selectNttList.do?bbsId=1362&mi=2891";
      item.note =
        "June 1 MOTIE/KCS monthly release reported May exports of USD 87.75B (+53.2% YoY) and semiconductor exports of USD 37.16B (+169.4% YoY). KCS later listed the official May monthly final bulletin on 2026-06-15, confirming the release window.";
    }
  }

  for (const point of store.monthly ?? []) {
    if (point.productKey === "semiconductor" && point.period === "2026.05") {
      point.source = "official_public_crosschecked";
      point.status = "final";
      point.finalSourceName = "KCS 2026 May monthly import/export status [final]";
      point.finalSourceUrl = "https://www.customs.go.kr/kcs/na/ntt/selectNttList.do?bbsId=1362&mi=2891";
      point.officialListUrl = "https://www.customs.go.kr/kcs/na/ntt/selectNttList.do?bbsId=1362&mi=2891";
      point.note =
        "May semiconductor exports reached USD 37.16B, up 169.4% YoY; total exports reached USD 87.75B, up 53.2% YoY. The June 1 MOTIE/KCS release was later reflected in the KCS May final monthly bulletin list on 2026-06-15.";
    }
  }

  for (const point of store.officialMonthly ?? []) {
    if (point.productKey === "semiconductor" && point.period === "2026.05") {
      point.source = "official_public_crosschecked";
      point.status = "final";
      point.finalSourceName = "KCS 2026 May monthly import/export status [final]";
      point.finalSourceUrl = "https://www.customs.go.kr/kcs/na/ntt/selectNttList.do?bbsId=1362&mi=2891";
      point.officialListUrl = "https://www.customs.go.kr/kcs/na/ntt/selectNttList.do?bbsId=1362&mi=2891";
      point.note =
        "May semiconductor exports reached USD 37.16B, up 169.4% YoY; total exports reached USD 87.75B, up 53.2% YoY. KCS listed the May final monthly bulletin on 2026-06-15.";
    }
  }

  for (const point of store.preliminary ?? []) {
    if (point.productKey === "semiconductor" && point.period === "2026.05-1~31") {
      point.source = "official_public_crosschecked";
      point.finalSourceName = "KCS 2026 May monthly import/export status [final]";
      point.finalSourceUrl = "https://www.customs.go.kr/kcs/na/ntt/selectNttList.do?bbsId=1362&mi=2891";
      point.officialListUrl = "https://www.customs.go.kr/kcs/na/ntt/selectNttList.do?bbsId=1362&mi=2891";
      point.note =
        "May monthly release: total exports USD 87.75B (+53.2% YoY), semiconductor exports USD 37.16B (+169.4% YoY). KCS listed the May final monthly bulletin on 2026-06-15.";
    }
  }

  const tenDayFreshness = store.freshness?.find((item) => item.key === "ten_day_semiconductor");
  if (tenDayFreshness?.latestPeriod === "2026年6月1-20日") {
    tenDayFreshness.nextExpectedDate = "2026-07-13 左右发布 2026年7月1-10日旬度暂定值";
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
  const taiwanDemand = await refreshTaiwanDemand(base.taiwanDemand);

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
      monthly: refresh.monthly,
      taiwanDemand
    };
    updateMonthlyHsMetadata(store, latestPeriod, refresh.source);
    updateMonthlySemiconductorMetadata(store);
    await writeStore(store);
    await writeTaiwanDemand(taiwanDemand);
    return store;
  } catch (error) {
    base.meta = {
      ...base.meta,
      message: `官方接口拉取失败，保留最近一次已核验数据：${error instanceof Error ? error.message : "unknown error"}`
    };
    base.taiwanDemand = taiwanDemand;
    await writeStore(base);
    await writeTaiwanDemand(taiwanDemand);
    return base;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  refreshTradeData()
    .then((store) => {
      const routePeriods = store.taiwanDemand?.meta?.routeLatestPeriods ?? {};
      console.log(
        `[refresh] ${store.meta.mode}: ${store.monthly.length} monthly points; Taiwan routes Korea ${routePeriods.korea_to_taiwan_electrical ?? "--"}, Japan ${routePeriods.japan_to_taiwan_ssd ?? "--"}`
      );
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
