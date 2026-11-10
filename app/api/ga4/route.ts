
import { NextRequest, NextResponse } from "next/server";
import { BetaAnalyticsDataClient } from "@google-analytics/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Store = "br" | "en" | "es";

const properties: Record<Store, string> = {
  br: "494454950",
  en: "494483822",
  es: "494471953",
};

type ReportRow = {
  dimensions: string[];
  metrics: number[];
};

type GroupedProduct = {
  itemId: string;
  name: string;
  views: number;
  quoteAdds: number;
  aliases: string[];
};

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return date;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getPreviousPeriod(start: string, end: string) {
  const startDate = parseDate(start)!;
  const endDate = parseDate(end)!;

  const days =
    Math.round(
      (endDate.getTime() - startDate.getTime()) / 86400000,
    ) + 1;

  const previousEnd = new Date(startDate);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);

  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(
    previousStart.getUTCDate() - days + 1,
  );

  return {
    from: formatDate(previousStart),
    to: formatDate(previousEnd),
    days,
  };
}

function groupProducts(rows: ReportRow[]): GroupedProduct[] {
  const grouped = new Map<
    string,
    {
      itemId: string;
      views: number;
      quoteAdds: number;
      names: Map<
        string,
        {
          views: number;
          quoteAdds: number;
        }
      >;
    }
  >();

  for (const row of rows) {
    const itemId = row.dimensions[0]?.trim() || "";
    const itemName = row.dimensions[1]?.trim() || "";

    if (!itemId && !itemName) continue;

    const hasId = itemId && itemId !== "(not set)";

    const key = hasId
      ? `id:${itemId}`
      : `name:${itemName}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        itemId: hasId ? itemId : "",
        views: 0,
        quoteAdds: 0,
        names: new Map(),
      });
    }

    const product = grouped.get(key)!;
    const views = row.metrics[0] || 0;
    const quoteAdds = row.metrics[1] || 0;

    product.views += views;
    product.quoteAdds += quoteAdds;

    if (itemName && itemName !== "(not set)") {
      const existing = product.names.get(itemName) || {
        views: 0,
        quoteAdds: 0,
      };

      existing.views += views;
      existing.quoteAdds += quoteAdds;

      product.names.set(itemName, existing);
    }
  }

  return [...grouped.values()]
    .map((product) => {
      const names = [...product.names.entries()].sort(
        (a, b) =>
          b[1].views - a[1].views ||
          b[1].quoteAdds - a[1].quoteAdds,
      );

      const primaryName =
        names[0]?.[0] ||
        (product.itemId
          ? `Produto ${product.itemId}`
          : "Produto sem identificação");

      return {
        itemId: product.itemId,
        name: primaryName,
        views: product.views,
        quoteAdds: product.quoteAdds,
        aliases: names
          .map(([name]) => name)
          .filter((name) => name !== primaryName),
      };
    })
    .sort((a, b) => b.views - a.views);
}

function overviewFromRows(rows: ReportRow[]) {
  const metrics = rows[0]?.metrics || [];

  return {
    sessions: metrics[0] || 0,
    activeUsers: metrics[1] || 0,
    pageViews: metrics[2] || 0,
    engagedSessions: metrics[3] || 0,
    engagementRate: metrics[4] || 0,
    avgSessionSeconds: metrics[5] || 0,
  };
}

function dateRangeDays(from: string, to: string) {
  const result: string[] = [];
  const current = parseDate(from)!;
  const last = parseDate(to)!;

  while (current <= last) {
    result.push(formatDate(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return result;
}

function formatDailyRows(
  rows: ReportRow[],
  from: string,
  to: string,
) {
  const byDate = new Map(
    rows.map((row) => [
      row.dimensions[0],
      row.metrics[0] || 0,
    ]),
  );

  return dateRangeDays(from, to).map((date) => ({
    date,
    sessions:
      byDate.get(date.replaceAll("-", "")) || 0,
  }));
}

export async function GET(req: NextRequest) {
  const requestedStore =
    req.nextUrl.searchParams.get("store") || "br";

  if (
    requestedStore !== "br" &&
    requestedStore !== "en" &&
    requestedStore !== "es"
  ) {
    return NextResponse.json(
      { error: "Loja inválida. Utilize br, en ou es." },
      { status: 400 },
    );
  }

  const store: Store = requestedStore;
  const property = properties[store];

  const start =
    req.nextUrl.searchParams.get("start") || "2026-08-11";

  const end =
    req.nextUrl.searchParams.get("end") || "2026-11-08";

  const startDate = parseDate(start);
  const endDate = parseDate(end);

  if (!startDate || !endDate || startDate > endDate) {
    return NextResponse.json(
      { error: "Período inválido." },
      { status: 400 },
    );
  }

  const previousPeriod = getPreviousPeriod(start, end);

  const raw = process.env.GA4_SERVICE_ACCOUNT_JSON;

  if (!raw) {
    return NextResponse.json(
      {
        error:
          "Conexão GA4 não configurada. Defina GA4_SERVICE_ACCOUNT_JSON.",
      },
      { status: 503 },
    );
  }

  try {
    const credentials = JSON.parse(raw);

    if (credentials.private_key) {
      credentials.private_key =
        credentials.private_key.replace(/\\n/g, "\n");
    }

    const client = new BetaAnalyticsDataClient({
      credentials,
    });

    async function report(
      dimensions: string[],
      metrics: string[],
      from: string,
      to: string,
      all = false,
    ): Promise<ReportRow[]> {
      const result: ReportRow[] = [];
      let offset = 0;

      do {
        const [response] = await client.runReport({
          property: `properties/${property}`,
          dateRanges: [
            {
              startDate: from,
              endDate: to,
            },
          ],
          dimensions: dimensions.map((name) => ({
            name,
          })),
          metrics: metrics.map((name) => ({
            name,
          })),
          limit: all ? 10000 : 1000,
          offset,
          keepEmptyRows: false,
        });

        const rows: ReportRow[] = (
          response.rows || []
        ).map((row) => ({
          dimensions: (row.dimensionValues || []).map(
            (value) => value.value || "",
          ),
          metrics: (row.metricValues || []).map(
            (value) => Number(value.value || 0),
          ),
        }));

        result.push(...rows);
        offset += rows.length;

        if (
          !all ||
          !rows.length ||
          offset >= Number(response.rowCount || 0) ||
          offset >= 1000000
        ) {
          break;
        }
      } while (true);

      return result;
    }

    const overviewMetrics = [
      "sessions",
      "activeUsers",
      "screenPageViews",
      "engagedSessions",
      "engagementRate",
      "averageSessionDuration",
    ];

    const [
      totals,
      previousTotals,
      currentDailyRows,
      previousDailyRows,
      paths,
      events,
      channels,
      devices,
      countries,
      landings,
      items,
    ] = await Promise.all([
      report([], overviewMetrics, start, end),

      report(
        [],
        overviewMetrics,
        previousPeriod.from,
        previousPeriod.to,
      ),

      report(
        ["date"],
        ["sessions"],
        start,
        end,
        true,
      ),

      report(
        ["date"],
        ["sessions"],
        previousPeriod.from,
        previousPeriod.to,
        true,
      ),

      report(
        ["pagePath"],
        ["screenPageViews"],
        start,
        end,
        true,
      ),

      report(
        ["eventName"],
        ["eventCount"],
        start,
        end,
        true,
      ),

      report(
        ["sessionDefaultChannelGroup"],
        ["sessions"],
        start,
        end,
        true,
      ),

      report(
        ["deviceCategory"],
        ["sessions"],
        start,
        end,
        true,
      ),

      report(
        ["country"],
        ["sessions"],
        start,
        end,
        true,
      ),

      report(
        ["landingPage"],
        ["sessions"],
        start,
        end,
        true,
      ),

      report(
        ["itemId", "itemName"],
        ["itemsViewed", "itemsAddedToCart"],
        start,
        end,
        true,
      ),
    ]);

    const overview = overviewFromRows(totals);
    const previousOverview =
      overviewFromRows(previousTotals);

    const currentDaily = formatDailyRows(
      currentDailyRows,
      start,
      end,
    );

    const previousDaily = formatDailyRows(
      previousDailyRows,
      previousPeriod.from,
      previousPeriod.to,
    );

    // Compara o dia 1 de cada intervalo, dia 2 etc.
    const dailyComparison = currentDaily.map(
      (day, index) => ({
        day: index + 1,
        currentDate: day.date,
        previousDate: previousDaily[index]?.date || "",
        currentSessions: day.sessions,
        previousSessions:
          previousDaily[index]?.sessions || 0,
      }),
    );

    const eventCount = (name: string) =>
      events.find(
        (row) => row.dimensions[0] === name,
      )?.metrics[0] || 0;

    // A comparação de orçamentos usa o mesmo evento
    // add_to_cart que alimenta o card atual.
    const previousAddToCart = await report(
      ["eventName"],
      ["eventCount"],
      previousPeriod.from,
      previousPeriod.to,
      true,
    );

    const previousQuoteAdds =
      previousAddToCart.find(
        (row) => row.dimensions[0] === "add_to_cart",
      )?.metrics[0] || 0;

    return NextResponse.json({
      source: "ga4-live",
      store,
      property,

      period: {
        from: start,
        to: end,
      },

      previousPeriod: {
        from: previousPeriod.from,
        to: previousPeriod.to,
      },

      overview,

      previousOverview,

      comparison: {
        current: {
          sessions: overview.sessions,
          activeUsers: overview.activeUsers,
          pageViews: overview.pageViews,
          quoteAdds: eventCount("add_to_cart"),
        },
        previous: {
          sessions: previousOverview.sessions,
          activeUsers: previousOverview.activeUsers,
          pageViews: previousOverview.pageViews,
          quoteAdds: previousQuoteAdds,
        },
      },

      dailyComparison,

      pages: paths
        .map((row) => ({
          path: row.dimensions[0],
          views: row.metrics[0],
        }))
        .sort((a, b) => b.views - a.views),

      events: events.map((row) => ({
        name: row.dimensions[0],
        count: row.metrics[0],
      })),

      channels: channels
        .map((row) => ({
          name: row.dimensions[0],
          sessions: row.metrics[0],
        }))
        .sort((a, b) => b.sessions - a.sessions),

      devices: devices.map((row) => ({
        name: row.dimensions[0],
        sessions: row.metrics[0],
      })),

      countries: countries
        .map((row) => ({
          name: row.dimensions[0],
          sessions: row.metrics[0],
        }))
        .sort((a, b) => b.sessions - a.sessions),

      landings: landings
        .map((row) => ({
          path: row.dimensions[0],
          sessions: row.metrics[0],
        }))
        .sort((a, b) => b.sessions - a.sessions),

      products: groupProducts(items),
    });
  } catch (error) {
    console.error(
      `GA4 error - store=${store}, property=${property}`,
      error,
    );

    return NextResponse.json(
      {
        error:
          "Falha na consulta GA4. Verifique as permissões, credenciais e o período selecionado.",
      },
      { status: 502 },
    );
  }
}
