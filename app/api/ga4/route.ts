
import { NextRequest, NextResponse } from 'next/server';
import { BetaAnalyticsDataClient } from '@google-analytics/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Store = 'br' | 'en' | 'es';

const properties: Record<Store, string> = {
  br: '494454950',
  en: '494483822',
  es: '494471953',
};

const valid = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value);

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
    const itemId = row.dimensions[0]?.trim() || '';
    const itemName = row.dimensions[1]?.trim() || '';

    if (!itemId && !itemName) continue;

    const key =
      itemId && itemId !== '(not set)'
        ? `id:${itemId}`
        : `name:${itemName}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        itemId: itemId === '(not set)' ? '' : itemId,
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

    if (itemName && itemName !== '(not set)') {
      const existingName = product.names.get(itemName) || {
        views: 0,
        quoteAdds: 0,
      };

      existingName.views += views;
      existingName.quoteAdds += quoteAdds;

      product.names.set(itemName, existingName);
    }
  }

  return [...grouped.values()]
    .map((product) => {
      const names = [...product.names.entries()].sort(
        (a, b) => {
          const viewsDifference = b[1].views - a[1].views;

          if (viewsDifference !== 0) {
            return viewsDifference;
          }

          return b[1].quoteAdds - a[1].quoteAdds;
        },
      );

      const primaryName =
        names[0]?.[0] ||
        (product.itemId
          ? `Produto ${product.itemId}`
          : 'Produto sem identificação');

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

export async function GET(req: NextRequest) {
  const requestedStore =
    req.nextUrl.searchParams.get('store') || 'br';

  if (
    requestedStore !== 'br' &&
    requestedStore !== 'en' &&
    requestedStore !== 'es'
  ) {
    return NextResponse.json(
      { error: 'Loja inválida. Utilize br, en ou es.' },
      { status: 400 },
    );
  }

  const store: Store = requestedStore;
  const property = properties[store];

  const start =
    req.nextUrl.searchParams.get('start') || '2026-08-11';

  const end =
    req.nextUrl.searchParams.get('end') || '2026-11-08';

  if (!valid(start) || !valid(end) || start > end) {
    return NextResponse.json(
      { error: 'Período inválido' },
      { status: 400 },
    );
  }

  const raw = process.env.GA4_SERVICE_ACCOUNT_JSON;

  if (!raw) {
    return NextResponse.json(
      {
        error:
          'Conexão GA4 não configurada. Defina GA4_SERVICE_ACCOUNT_JSON no .env.local e conceda acesso de leitura à conta de serviço nas três propriedades.',
      },
      { status: 503 },
    );
  }

  try {
    const credentials = JSON.parse(raw);

    if (credentials.private_key) {
      credentials.private_key =
        credentials.private_key.replace(/\\n/g, '\n');
    }

    const client = new BetaAnalyticsDataClient({
      credentials,
    });

    const range = [
      {
        startDate: start,
        endDate: end,
      },
    ];

    async function report(
      dimensions: string[],
      metrics: string[],
      all = false,
    ): Promise<ReportRow[]> {
      const result: ReportRow[] = [];
      let offset = 0;

      do {
        const [response] = await client.runReport({
          property: `properties/${property}`,
          dateRanges: range,
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
          dimensions: (
            row.dimensionValues || []
          ).map((value) => value.value || ''),
          metrics: (
            row.metricValues || []
          ).map((value) => Number(value.value || 0)),
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

    const [
      totals,
      paths,
      events,
      channels,
      devices,
      countries,
      landings,
      items,
    ] = await Promise.all([
      report(
        [],
        [
          'sessions',
          'activeUsers',
          'screenPageViews',
          'engagedSessions',
          'engagementRate',
          'averageSessionDuration',
        ],
      ),

      report(
        ['pagePath'],
        ['screenPageViews'],
        true,
      ),

      report(
        ['eventName'],
        ['eventCount'],
        true,
      ),

      report(
        ['sessionDefaultChannelGroup'],
        ['sessions'],
        true,
      ),

      report(
        ['deviceCategory'],
        ['sessions'],
        true,
      ),

      report(
        ['country'],
        ['sessions'],
        true,
      ),

      report(
        ['landingPage'],
        ['sessions'],
        true,
      ),

      report(
        ['itemId', 'itemName'],
        ['itemsViewed', 'itemsAddedToCart'],
        true,
      ),
    ]);

    const t = totals[0]?.metrics || [];
    const products = groupProducts(items);

    return NextResponse.json({
      source: 'ga4-live',
      store,
      property,

      period: {
        from: start,
        to: end,
      },

      overview: {
        sessions: t[0] || 0,
        activeUsers: t[1] || 0,
        pageViews: t[2] || 0,
        engagedSessions: t[3] || 0,
        engagementRate: t[4] || 0,
        avgSessionSeconds: t[5] || 0,
      },

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

      products,
    });
  } catch (error) {
    console.error(
      `GA4 error - store=${store}, property=${property}`,
      error,
    );

    const storeName =
      store === 'br'
        ? 'brasileira'
        : store === 'en'
          ? 'inglesa'
          : 'espanhola';

    return NextResponse.json(
      {
        error:
          `Falha na consulta GA4 da loja ${storeName}. Verifique as permissões e credenciais da conta de serviço.`,
      },
      { status: 502 },
    );
  }
}
