import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { productConfigs } from "./config.js";

const sampleSnapshotUpdatedAt = "2026-06-11T09:30:00.000Z";

const provisionalDetailPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "provisional-memory-detail.json");
const taiwanDemandPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "taiwan-ai-demand.json");

function loadProvisionalMemoryDetail() {
  return JSON.parse(readFileSync(provisionalDetailPath, "utf8"));
}

function loadTaiwanDemand() {
  return JSON.parse(readFileSync(taiwanDemandPath, "utf8"));
}

const periods = [
  "2025.01",
  "2025.02",
  "2025.03",
  "2025.04",
  "2025.05",
  "2025.06",
  "2025.07",
  "2025.08",
  "2025.09",
  "2025.10",
  "2025.11",
  "2025.12",
  "2026.01",
  "2026.02",
  "2026.03",
  "2026.04"
];

const monthlyHsSource = {
  source: "official_tradedata_web",
  sourceName: "KCS TradeData English by H.S Code monthly statistics",
  sourceUrl: "https://www.tradedata.go.kr/cts/hmpgEng/openETS0200013Q.do?menuId=ETS_MNE_10200000"
};

function makeSeries(productKey, valuesUsd, weightsKg) {
  const product = productConfigs.find((item) => item.key === productKey);
  return periods.map((period, index) => {
    const weightKg = weightsKg[index];
    const valueUsd = valuesUsd[index];
    return {
      period,
      periodLabel: period.replace(".", "-"),
      valueUsd,
      weightKg,
      unitPriceUsdPerKg: weightKg > 0 ? valueUsd / weightKg : null,
      hsCode: product.hsCode,
      productKey,
      productName: product.name,
      ...monthlyHsSource,
      status: "final"
    };
  });
}

export function buildSampleStore({ lastUpdated = sampleSnapshotUpdatedAt } = {}) {
  const monthly = [
    ...makeSeries(
      "ssd",
      [
        640_157_000,
        622_804_000,
        1_001_625_000,
        472_586_000,
        906_047_000,
        1_133_937_000,
        751_929_000,
        1_031_464_000,
        1_069_137_000,
        823_519_000,
        1_203_535_000,
        1_796_519_000,
        1_365_724_000,
        2_417_571_000,
        3_190_956_000,
        3_836_678_000
      ],
      [
        144_646,
        133_970,
        198_385,
        114_107,
        185_466,
        219_753,
        183_961,
        235_401,
        264_206,
        194_641,
        228_411,
        266_224,
        207_161,
        218_033,
        253_531,
        202_057
      ]
    ),
    ...makeSeries(
      "dram_hbm",
      [
        4_765_687_000,
        4_725_937_000,
        6_694_284_000,
        5_761_054_000,
        7_337_464_000,
        8_230_251_000,
        7_560_781_000,
        8_504_645_000,
        9_345_975_000,
        8_886_616_000,
        10_163_661_000,
        12_636_910_000,
        12_111_963_000,
        15_810_750_000,
        20_758_802_000,
        20_829_061_000
      ],
      [
        229_221,
        253_709,
        333_624,
        282_830,
        341_367,
        378_326,
        331_549,
        325_040,
        369_663,
        310_323,
        306_192,
        359_384,
        302_637,
        287_910,
        375_392,
        319_349
      ]
    )
  ];

  return {
    meta: {
      lastUpdated,
      nextScheduledUpdate: null,
      mode: "mixed_public",
      message:
        "公开数据已覆盖至：SSD 与 DRAM/HBM 月度 HS 2026年4月、半导体月度 2026年5月、旬度高频窗口 2026年6月1-10日；截至 2026-06-11 未配置 DATA_GO_KR_SERVICE_KEY，月度 HS 来自 KCS TradeData 官方网页核验。"
    },
    products: productConfigs,
    monthly,
    freshness: [
      {
        key: "monthly_hs",
        label: "SSD / DRAM-HBM HS 明细",
        latestPeriod: "2026年4月",
        latestReleaseDate: "KCS TradeData 官方网页已更新至 2026.04",
        nextExpectedDate: "2026年5月最终值预计 2026年6月中旬随 KCS/data.go.kr/TRASS 更新",
        status: "official_public_web",
        note:
          "Chrome 可访问 KCS TradeData 英文 By H.S Code 页面，并通过页面同源查询取得月度出口金额和 KG。SSD 改用 HS 852351（Solid-state non-volatile storage devices），旧 HSK 8471704010 在当前官方查询中无结果；DRAM/HBM 继续用 HS 854232（Memories）。"
      },
      {
        key: "monthly_semiconductor",
        label: "半导体月度总量",
        latestPeriod: "2026年5月",
        latestReleaseDate: "2026-06-01",
        nextExpectedDate: "2026-07-01 左右发布 2026年6月月度初值",
        status: "official_public",
        note: "5 月半导体出口约 371.6 亿美元，同比 +169.4%；5 月总出口约 877.5 亿美元，同比 +53.2%，MOTIE/KCS 6 月 1 日月度口径。"
      },
      {
        key: "ten_day_semiconductor",
        label: "半导体旬度高频",
        latestPeriod: "2026年6月1-10日",
        latestReleaseDate: "2026-06-11",
        nextExpectedDate: "2026-06-21/22 左右发布 2026年6月1-20日旬度暂定值",
        status: "official_public_media_repost",
        note:
          "6 月 1-10 日半导体出口约 110.68 亿美元，同比 +205.8%；总出口 286.35 亿美元，同比 +85.9%，进口 233.52 亿美元，同比 +35.6%，贸易顺差 52.82 亿美元。"
      },
      {
        key: "memory_provisional_detail",
        label: "存储细分旬度暂估",
        latestPeriod: "2026年5月1-20日",
        latestReleaseDate: "2026-05-21",
        nextExpectedDate: "等待 TRASS/KITA 或市场转述公开 2026年5月全月细分数据",
        status: "market_repost_trass",
        note:
          "5 月前 20 日细分来自公开券商/市场 Telegram 镜像转述的 Korean customs/TRASS 暂估；KCS TradeData 官方 HWPX 已核验 5 月前 20 日半导体总量，但不拆分 DRAM/SSD/HBM。Memory 总额为 DRAM incl. modules + Flash memory + SSD 的派生值，MCP/HBM proxy 本轮公开源未给单位价。"
      }
    ],
    sourceRegistry: [
      {
        key: "kcs_tradedata_hs_monthly",
        section: "monthly_hs",
        sourceName: "KCS TradeData English by H.S Code monthly statistics",
        sourceUrl: "https://www.tradedata.go.kr/cts/hmpgEng/openETS0200013Q.do?menuId=ETS_MNE_10200000",
        status: "official_public_web_verified",
        note: "Browser-visible official KCS page provides monthly HS export value in thousand USD and export weight in KG through its same-site query. Verified 2025.01-2026.04 for SSD HS 852351 and DRAM/HBM proxy HS 854232."
      },
      {
        key: "data_go_kr_itemtrade",
        section: "monthly_hs",
        sourceName: "KCS/data.go.kr Itemtrade API",
        sourceUrl: "https://www.data.go.kr/data/15101609/openapi.do?recommendDataYn=Y",
        status: "requires_DATA_GO_KR_SERVICE_KEY",
        note: "Official API source for monthly HS export value and net weight. DATA_GO_KR_SERVICE_KEY was not present in the 2026-05-22 refresh environment; use SSD HS 852351 and DRAM/HBM proxy HS 854232 when configured."
      },
      {
        key: "korea_ict_202604",
        section: "memory_provisional_detail,monthly_hs_context",
        sourceName: "Korea.kr / MSIT April 2026 ICT export-import trends",
        sourceUrl: "https://m.korea.kr/news/pressReleaseView.do?newsId=156761512&pWise=mSub&pWiseSub=C2",
        status: "official_public_context",
        note: "Official public context for April ICT exports, including SSD export value of USD 3.84B and semiconductor/memory market-price commentary; it does not provide HS net weight or USD/kg."
      },
      {
        key: "kcs_tradedata_20260520",
        section: "memory_provisional_detail,ten_day_semiconductor",
        sourceName: "KCS TradeData press-release list, May 1-20 provisional import/export status",
        sourceUrl: "https://www.tradedata.go.kr/cts/index.do",
        status: "official_public_aggregate",
        note: "Official KCS TradeData homepage exposes the May 1-20 provisional release entry dated 2026-05-21. Same-day media reports quoting the KCS release provide semiconductor exports of USD 21,951M, YoY +202.1%; no official public page found with a DRAM/SSD/HBM split."
      },
      {
        key: "trass_public_20260520",
        section: "ten_day_semiconductor",
        sourceName: "TRASS public homepage, provisional trade summary",
        sourceUrl: "https://www.bandtrass.or.kr/index.do",
        status: "public_aggregate_only",
        note: "Public homepage shows 2026 May 1-20 provisional total exports of USD 52,652M (+64.78%) and imports of USD 41,618M (+29.28%), but product-level provisional lookup is marked premium and was not publicly accessible."
      },
      {
        key: "korea_kr_20260520",
        section: "ten_day_semiconductor",
        sourceName: "Korea.kr repost search for May 1-20 KCS provisional release",
        sourceUrl: "https://www.korea.kr/",
        status: "not_found_2026_05_22",
        note: "Korea.kr search did not expose a repost of the 2026-05-21 KCS May 1-20 provisional release during this refresh."
      },
      {
        key: "motie_kcs_202605_monthly",
        section: "monthly_semiconductor,ten_day_semiconductor",
        sourceName: "MOTIE/KCS May 2026 Export-Import Trends, reported by ChosunBiz",
        sourceUrl: "https://biz.chosun.com/en/en-policy/2026/06/01/5BV3STEUKZBVNPUT556OFOA76I/",
        status: "official_public_media_repost",
        note: "June 1 monthly release reports May exports of USD 87.75B (+53.2% YoY) and semiconductor exports of USD 37.16B (+169.4% YoY). The dashboard derives the May 21-31 semiconductor tail from this monthly value minus the KCS May 1-20 value."
      },
      {
        key: "kcs_20260610_preliminary",
        section: "ten_day_semiconductor",
        sourceName: "KCS June 1-10 2026 provisional export-import status, reported by TaxTimes / Daum",
        sourceUrl: "https://www.taxtimes.co.kr/news/article.html?no=275489",
        status: "official_public_media_repost",
        note: "KCS announced the 2026 June 1-10 provisional trade release on June 11. Public reports give total exports of USD 28.635B (+85.9% YoY), imports of USD 23.352B (+35.6% YoY), trade surplus of USD 5.282B, and semiconductor exports of USD 11.068B (+205.8% YoY, 38.7% share)."
      },
      {
        key: "sk_securities_20260520_memory_detail",
        section: "memory_provisional_detail",
        sourceName: "SK Securities Semiconductor Telegram mirror, May 1-20 provisional semiconductor exports",
        sourceUrl: "https://t.me/s/skitteam/3951",
        status: "market_repost_trass",
        note: "Public mirror reports May 1-20 DRAM, DRAM module, NAND, MCP, and SSD export values with MoM/QoQ, and states the content is a public release. Used where official KCS source does not disclose product splits."
      },
      {
        key: "market_mirror_20260520_unit_price",
        section: "memory_provisional_detail",
        sourceName: "Market Telegram mirror of May 1-20 Korean semiconductor export table",
        sourceUrl: "https://t.me/s/bornlupin/18175",
        status: "market_repost_trass",
        note: "Public mirror reports May 1-20 DRAM incl./excl. modules, flash memory, and SSD export value, YoY, MoM, and USD/kg unit-price changes."
      },
      {
        key: "kita_kstat_public",
        section: "monthly_hs_context",
        sourceName: "KITA K-stat public page",
        sourceUrl: "https://stat.kita.net/newMain.screen",
        status: "official_or_industry_public_partial",
        note: "Browser-visible public page showed Korea updated to 2026.04 plus an 854232 export-by-country widget and 2026.04 ICT/IC semiconductor context, but not the monthly net-weight fields needed for USD/kg."
      }
    ],
    officialMonthly: [
      {
        period: "2026.03",
        periodLabel: "2026年3月",
        valueUsd: 32_829_000_000,
        productKey: "semiconductor",
        productName: "半导体出口",
        source: "official_public",
        status: "preliminary",
        sourceName: "MOTIE March 2026 Export-Import Trends, reported by Seoul Economic Daily",
        sourceUrl: "https://en.sedaily.com/news/2026/04/01/semiconductor-power-defies-war-monthly-exports-toward"
      },
      {
        period: "2026.04",
        periodLabel: "2026年4月",
        valueUsd: 31_900_000_000,
        valueYoYPct: 173.5,
        productKey: "semiconductor",
        productName: "半导体出口",
        source: "official_public",
        status: "preliminary",
        sourceName: "MOTIE April 2026 Export-Import Trends; KCS final April release listed 2026-05-15",
        sourceUrl: "https://www.asiae.co.kr/en/article/IT/2026050109205280402",
        finalSourceName: "KCS 2026 April monthly import/export status [final], reposted by NLIC",
        finalSourceUrl: "https://www.nlic.go.kr/nlic/logpolDt.action?command=VIEW&fldLogpolRefSeq=1941",
        officialListUrl: "https://www.customs.go.kr/kcs/na/ntt/selectNttList.do?bbsId=1362&mi=2891",
        note: "KCS official list verifies the April final release date; the dashboard keeps the rounded semiconductor value from the MOTIE monthly release."
      },
      {
        period: "2026.05",
        periodLabel: "2026年5月",
        valueUsd: 37_160_000_000,
        valueYoYPct: 169.4,
        overallExportValueUsd: 87_750_000_000,
        overallExportYoYPct: 53.2,
        productKey: "semiconductor",
        productName: "半导体出口",
        source: "official_public_media_repost",
        status: "preliminary",
        sourceName: "MOTIE/KCS May 2026 Export-Import Trends, reported by ChosunBiz",
        sourceUrl: "https://biz.chosun.com/en/en-policy/2026/06/01/5BV3STEUKZBVNPUT556OFOA76I/",
        note: "May semiconductor exports reached USD 37.16B, up 169.4% YoY; total exports reached USD 87.75B, up 53.2% YoY."
      }
    ],
    memoryDetail: loadProvisionalMemoryDetail(),
    taiwanDemand: loadTaiwanDemand(),
    preliminary: [
      {
        period: "2026.01-1~20",
        periodLabel: "1月1-20日",
        valueUsd: 10_732_000_000,
        weightKg: 0,
        unitPriceUsdPerKg: null,
        hsCode: "semiconductor",
        productKey: "semiconductor",
        productName: "半导体出口",
        source: "official_public_derived",
        status: "preliminary",
        sourceName: "KCS 2026-01-20 brief, reposted by Yonhap/Investing",
        sourceUrl: "https://kr.investing.com/news/economy-news/article-1791872"
      },
      {
        period: "2026.02-1~20",
        periodLabel: "2月1-20日",
        valueUsd: 15_115_000_000,
        weightKg: 0,
        unitPriceUsdPerKg: null,
        hsCode: "semiconductor",
        productKey: "semiconductor",
        productName: "半导体出口",
        source: "official_public_derived",
        status: "preliminary",
        sourceName: "KCS 2026-02-20 brief, reported by YTN/Daum",
        sourceUrl: "https://v.daum.net/v/3mrUUCqFTp"
      },
      {
        period: "2026.03-1~10",
        periodLabel: "3月1-10日",
        valueUsd: 7_600_000_000,
        weightKg: 0,
        unitPriceUsdPerKg: null,
        hsCode: "semiconductor",
        productKey: "semiconductor",
        productName: "半导体出口",
        source: "official_public",
        status: "preliminary",
        sourceName: "KCS 2026-03-10 brief",
        sourceUrl: "https://www.customs.go.kr/kcs/na/ntt/selectNttInfo.do?bbsId=1362&mi=2891&nttSn=10157444&nttSnUrl=fe825dff8cfc646ef2cc339174b85d9d"
      },
      {
        period: "2026.03-1~20",
        periodLabel: "3月1-20日",
        valueUsd: 18_700_000_000,
        weightKg: 0,
        unitPriceUsdPerKg: null,
        hsCode: "semiconductor",
        productKey: "semiconductor",
        productName: "半导体出口",
        source: "official_public",
        status: "preliminary",
        sourceName: "KCS 2026-03-20 brief",
        sourceUrl: "https://news.nate.com/view/20260323n07476"
      },
      {
        period: "2026.04-1~10",
        periodLabel: "4月1-10日",
        valueUsd: 8_600_000_000,
        weightKg: 0,
        unitPriceUsdPerKg: null,
        hsCode: "semiconductor",
        productKey: "semiconductor",
        productName: "半导体出口",
        source: "official_public",
        status: "preliminary",
        sourceName: "KCS / Korea.kr 2026-04-13 April 1-10 brief",
        sourceUrl: "https://m.korea.kr/news/pressReleaseView.do?newsId=156754147&pWise=mSub&pWiseSub=C5"
      },
      {
        period: "2026.04-1~20",
        periodLabel: "4月1-20日",
        valueUsd: 18_300_000_000,
        weightKg: 0,
        unitPriceUsdPerKg: null,
        hsCode: "semiconductor",
        productKey: "semiconductor",
        productName: "半导体出口",
        source: "official_public",
        status: "preliminary",
        sourceName: "KCS 2026-04-20 brief",
        sourceUrl: "https://www.customs.go.kr/kcs/na/ntt/selectNttInfo.do?nttSn=10161842&nttSnUrl=08ddacd727036284aa6c92dcbc73ada5"
      },
      {
        period: "2026.05-1~10",
        periodLabel: "5月1-10日",
        valueUsd: 8_500_000_000,
        weightKg: 0,
        unitPriceUsdPerKg: null,
        hsCode: "semiconductor",
        productKey: "semiconductor",
        productName: "半导体出口",
        source: "official_public",
        status: "preliminary",
        sourceName: "KCS / Korea.kr 2026-05-11 May 1-10 brief",
        sourceUrl: "https://m.korea.kr/briefing/pressReleaseView.do?newsId=156760738&pWise=mSub&pWiseSub=C7"
      },
      {
        period: "2026.05-1~20",
        periodLabel: "5月1-20日",
        valueUsd: 21_951_000_000,
        valueYoYPct: 202.1,
        weightKg: 0,
        unitPriceUsdPerKg: null,
        hsCode: "semiconductor",
        productKey: "semiconductor",
        productName: "半导体出口",
        source: "official_public_crosschecked",
        status: "preliminary",
        sourceName: "KCS TradeData May 1-20 provisional release listing",
        sourceUrl: "https://www.tradedata.go.kr/cts/index.do",
        attachmentFileName: "260521 26년 5월 1일 - 5월 20일 수출입현황.hwpx",
        attachmentValueUnit: "USD million",
        attachmentValue: 21_951,
        overallExportValueUsd: 52_652_000_000,
        overallExportYoYPct: 64.78,
        overallImportValueUsd: 41_618_000_000,
        overallImportYoYPct: 29.28,
        trassPublicSourceName: "TRASS public homepage, provisional trade summary",
        trassPublicSourceUrl: "https://www.bandtrass.or.kr/index.do",
        mirrorSourceUrl:
          "https://biz.chosun.com/policy/policy_sub/2026/05/21/E7LOYAUUORGTDMCJBAWY7HCZHI/?outputType=amp",
        officialListUrl: "https://www.customs.go.kr/kcs/na/ntt/selectNttList.do?bbsId=1362&mi=2891",
        note: "KCS TradeData homepage lists the 2026-05-21 provisional release; TRASS public homepage confirms the overall May 1-20 provisional trade totals. Same-day media reports quoting KCS provide semiconductor exports of USD 21,951M and YoY +202.1%. The publicly visible official listing does not provide a DRAM/SSD/HBM split."
      },
      {
        period: "2026.05-21~31",
        periodLabel: "5月21-31日",
        valueUsd: 15_209_000_000,
        weightKg: 0,
        unitPriceUsdPerKg: null,
        hsCode: "semiconductor",
        productKey: "semiconductor",
        productName: "半导体出口",
        source: "official_public_derived",
        status: "preliminary",
        sourceName: "Derived from May 2026 monthly release minus KCS May 1-20 provisional release",
        sourceUrl: "https://biz.chosun.com/en/en-policy/2026/06/01/5BV3STEUKZBVNPUT556OFOA76I/",
        monthlyValueUsd: 37_160_000_000,
        firstTwentyDayValueUsd: 21_951_000_000,
        overallExportValueUsd: 35_098_000_000,
        overallExportDerivation: "87.75B May total exports - 52.652B May 1-20 exports",
        note: "Tail-window value is derived because the public monthly release gives full-month semiconductor exports and KCS May 1-20 provides the cumulative first-20-day value."
      },
      {
        period: "2026.05-1~31",
        periodLabel: "5月全月",
        valueUsd: 37_160_000_000,
        valueYoYPct: 169.4,
        weightKg: 0,
        unitPriceUsdPerKg: null,
        hsCode: "semiconductor",
        productKey: "semiconductor",
        productName: "半导体出口",
        source: "official_public_media_repost",
        status: "preliminary",
        sourceName: "MOTIE/KCS May 2026 Export-Import Trends, reported by ChosunBiz",
        sourceUrl: "https://biz.chosun.com/en/en-policy/2026/06/01/5BV3STEUKZBVNPUT556OFOA76I/",
        overallExportValueUsd: 87_750_000_000,
        overallExportYoYPct: 53.2,
        note: "May monthly release: total exports USD 87.75B (+53.2% YoY), semiconductor exports USD 37.16B (+169.4% YoY)."
      },
      {
        period: "2026.06-1~10",
        periodLabel: "6月1-10日",
        valueUsd: 11_068_000_000,
        valueYoYPct: 205.8,
        weightKg: 0,
        unitPriceUsdPerKg: null,
        hsCode: "semiconductor",
        productKey: "semiconductor",
        productName: "半导体出口",
        source: "official_public_media_repost",
        status: "preliminary",
        sourceName: "KCS June 1-10 2026 provisional release, reported by TaxTimes / Daum",
        sourceUrl: "https://www.taxtimes.co.kr/news/article.html?no=275489",
        mirrorSourceUrl: "https://v.daum.net/v/20260611093006216",
        overallExportValueUsd: 28_635_000_000,
        overallExportYoYPct: 85.9,
        overallImportValueUsd: 23_352_000_000,
        overallImportYoYPct: 35.6,
        tradeBalanceUsd: 5_282_000_000,
        workingDays: 7.0,
        averageDailyExportUsd: 4_090_000_000,
        averageDailyExportYoYPct: 46.1,
        semiconductorSharePct: 38.7,
        note: "KCS June 1-10 provisional release: total exports USD 28.635B (+85.9% YoY), imports USD 23.352B (+35.6% YoY), trade surplus USD 5.282B, and semiconductor exports USD 11.068B (+205.8% YoY)."
      }
    ]
  };
}
