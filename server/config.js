import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const paths = {
  rootDir,
  publicDir: path.join(rootDir, "public"),
  dataFile: path.join(rootDir, "data", "trade-data.json")
};

export const productConfigs = [
  {
    key: "ssd",
    name: "SSD",
    hsCode: "852351",
    unitBasis: "kg",
    note: "HS 8523.51 为 Solid-state non-volatile storage devices；KCS TradeData 当前可查询该口径，已通过网页接口核验至 2026年5月。"
  },
  {
    key: "dram_hbm",
    name: "DRAM / HBM",
    hsCode: "854232",
    unitBasis: "kg",
    note: "HS 8542.32 为存储器类大项，HBM 通常归入该 DRAM/Memory 口径，需结合产品结构解读。"
  }
];

export const env = {
  port: Number(process.env.PORT ?? 8787),
  serviceKey: process.env.DATA_GO_KR_SERVICE_KEY,
  updateHour: Number(process.env.UPDATE_HOUR ?? 15),
  updateMinute: Number(process.env.UPDATE_MINUTE ?? 30),
  updateTimezone: process.env.UPDATE_TIMEZONE ?? "Asia/Seoul",
  lookbackMonths: Number(process.env.LOOKBACK_MONTHS ?? 18)
};
