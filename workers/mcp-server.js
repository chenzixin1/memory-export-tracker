import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";
import { z } from "zod";
import {
  buildMemoryDetail,
  buildMonthlySeries,
  buildOverview,
  buildSources,
  buildTaiwanRoutes,
  dataApiCatalog
} from "../shared/data-api.js";

export function serveMemoryExportMcp(request, env, ctx, loadStore) {
  const server = createMemoryExportServer(loadStore);
  return createMcpHandler(server, {
    route: "/mcp",
    corsOptions: {
      origin: "*",
      methods: "GET, POST, OPTIONS",
      headers: ["content-type", "authorization", "mcp-session-id"]
    }
  })(request, env, ctx);
}

function createMemoryExportServer(loadStore) {
  const server = new McpServer({
    name: "memory-export-tracker",
    version: "0.1.0"
  });

  server.tool("list_data_endpoints", "List public REST and MCP data entry points for the memory export dashboard.", {}, async () => {
    return text({ endpoints: dataApiCatalog });
  });

  server.tool("get_dashboard_overview", "Return the latest dashboard overview and freshness state.", {}, async () => {
    return text(buildOverview(await loadStore()));
  });

  server.tool(
    "get_monthly_series",
    "Return monthly HS data for SSD, DRAM/HBM, or all products.",
    {
      product: z.enum(["ssd", "dram_hbm", "all"]).default("all"),
      range: z.union([z.number().int().positive().max(120), z.literal("all")]).default(12)
    },
    async ({ product, range }) => {
      return text(buildMonthlySeries(await loadStore(), { product, range }));
    }
  );

  server.tool(
    "get_memory_detail",
    "Return provisional memory detail rows such as DRAM, SSD, NAND, and MCP/HBM proxy.",
    {
      category: z.string().default("all")
    },
    async ({ category }) => {
      return text(buildMemoryDetail(await loadStore(), { category }));
    }
  );

  server.tool(
    "get_taiwan_routes",
    "Return Taiwan-side proxy and auxiliary routes currently available in the dashboard.",
    {
      route: z.string().optional()
    },
    async ({ route }) => {
      return text(buildTaiwanRoutes(await loadStore(), { route }));
    }
  );

  server.tool("get_source_registry", "Return source registry, freshness notes, and product HS-code notes.", {}, async () => {
    return text(buildSources(await loadStore()));
  });

  return server;
}

function text(payload) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2)
      }
    ]
  };
}
