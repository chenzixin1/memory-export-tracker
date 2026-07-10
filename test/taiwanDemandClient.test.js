import test from "node:test";
import assert from "node:assert/strict";
import {
  discoverJapanSectionCsvUrl,
  parseJapanSsdCsv,
  parseTaiwanMofCsv,
  resolveTaiwanCsvUrl
} from "../server/taiwanDemandClient.js";

test("resolveTaiwanCsvUrl reads the current resource URL from official metadata", () => {
  assert.equal(
    resolveTaiwanCsvUrl({ result: { distribution: [{ resourceDownloadUrl: "https://example.gov.tw/current.csv" }] } }),
    "https://example.gov.tw/current.csv"
  );
});

test("parseTaiwanMofCsv converts ROC monthly rows and thousand USD values", () => {
  const csv = [
    '"國家/地區別","總計(千美元)","16.機械及電機設備(千美元)"',
    '"115年 (1~6月)",46590504,41690749',
    '"115年 5月",8906791,7925569',
    '"115年 6月",10196891,9247498'
  ].join("\n");

  assert.deepEqual(parseTaiwanMofCsv(csv), [
    { period: "2026.05", totalImportUsd: 8_906_791_000, valueUsd: 7_925_569_000 },
    { period: "2026.06", totalImportUsd: 10_196_891_000, valueUsd: 9_247_498_000 }
  ]);
});

test("discoverJapanSectionCsvUrl finds the Chapter 84-85 official download", () => {
  const html = `
    <a href="/en/stat-search/file-download?statInfId=000040466793&amp;fileKind=1">CSV</a>
    <div>Section XV Chapter 72-83</div>
    <div class="item">
      <span>Commodity by Country (Export Jan-May:Detailed) Section XVI Chapter 84-85</span>
      <a href="/en/stat-search/file-download?statInfId=000040466794&amp;fileKind=1">CSV</a>
    </div>`;

  assert.equal(
    discoverJapanSectionCsvUrl(html),
    "https://www.e-stat.go.jp/en/stat-search/file-download?statInfId=000040466794&fileKind=1"
  );
});

test("discoverJapanSectionCsvUrl accepts an already decoded query separator", () => {
  const html = `Section XVI Chapter 84-85
    <a href="/en/stat-search/file-download?statInfId=000040466794&fileKind=1">CSV</a>`;

  assert.equal(
    discoverJapanSectionCsvUrl(html),
    "https://www.e-stat.go.jp/en/stat-search/file-download?statInfId=000040466794&fileKind=1"
  );
});

test("parseJapanSsdCsv selects Taiwan HS 852351000 and expands thousand JPY", () => {
  const csv = [
    "Exp or Imp,Year,HS,Country,Unit1,Unit2,Quantity1-Year,Quantity2-Year,Value-Year,Quantity1-Jan,Quantity2-Jan,Value-Jan,Quantity1-Feb,Quantity2-Feb,Value-Feb,Quantity1-Mar,Quantity2-Mar,Value-Mar,Quantity1-Apr,Quantity2-Apr,Value-Apr,Quantity1-May,Quantity2-May,Value-May",
    "1,2026,'852351000',105,  ,NO,0,1,2,0,1,2,0,1,2,0,1,2,0,1,2,0,1,2",
    "2,2026,'852351000',106,  ,NO,0,9,9,0,9,9,0,9,9,0,9,9,0,9,9,0,9,9",
    "1,2026,'852351000',106,  ,NO,0,339580,2047652,0,62772,544477,0,54546,92551,0,50501,355826,0,60417,664647,0,111344,390151"
  ].join("\n");

  assert.deepEqual(parseJapanSsdCsv(csv), [
    { period: "2026.01", quantityUnits: 62_772, valueJpy: 544_477_000 },
    { period: "2026.02", quantityUnits: 54_546, valueJpy: 92_551_000 },
    { period: "2026.03", quantityUnits: 50_501, valueJpy: 355_826_000 },
    { period: "2026.04", quantityUnits: 60_417, valueJpy: 664_647_000 },
    { period: "2026.05", quantityUnits: 111_344, valueJpy: 390_151_000 }
  ]);
});
