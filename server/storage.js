import fs from "node:fs/promises";
import path from "node:path";
import { paths } from "./config.js";
import { buildSampleStore } from "./sampleData.js";

export async function readStore() {
  try {
    const raw = await fs.readFile(paths.dataFile, "utf8");
    return JSON.parse(raw);
  } catch {
    return buildSampleStore();
  }
}

export async function writeStore(store) {
  await fs.mkdir(path.dirname(paths.dataFile), { recursive: true });
  await fs.writeFile(paths.dataFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  const publicDataFile = path.join(paths.publicDir, "data", "trade-data.json");
  await fs.mkdir(path.dirname(publicDataFile), { recursive: true });
  await fs.writeFile(publicDataFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

export async function writeTaiwanDemand(taiwanDemand) {
  await fs.mkdir(path.dirname(paths.taiwanDataFile), { recursive: true });
  await fs.writeFile(paths.taiwanDataFile, `${JSON.stringify(taiwanDemand, null, 2)}\n`, "utf8");
}
