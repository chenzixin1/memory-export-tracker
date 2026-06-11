import { fileURLToPath } from "node:url";
import path from "node:path";
import { productConfigs } from "../config.js";
import { fetchMonthlyProductSeries } from "../koreaTradeClient.js";
import { buildSampleStore } from "../sampleData.js";
import { writeStore } from "../storage.js";

export async function refreshTradeData() {
  if (!process.env.DATA_GO_KR_SERVICE_KEY) {
    const sample = buildSampleStore();
    await writeStore(sample);
    return sample;
  }

  try {
    const monthlyResponses = await Promise.all(productConfigs.map((product) => fetchMonthlyProductSeries(product)));
    const sample = buildSampleStore();
    const store = {
      ...sample,
      meta: {
        ...sample.meta,
        lastUpdated: new Date().toISOString(),
        nextScheduledUpdate: null,
        mode: "official_api",
        message: "已通过 KCS/data.go.kr 官方接口更新月度 HS 品类出口金额、净重与单位价格。"
      },
      products: productConfigs,
      monthly: monthlyResponses.flat()
    };
    await writeStore(store);
    return store;
  } catch (error) {
    const sample = buildSampleStore();
    sample.meta.message = `官方接口拉取失败，当前回落到样例数据：${error instanceof Error ? error.message : "unknown error"}`;
    await writeStore(sample);
    return sample;
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
