
import { NextRequest, NextResponse } from "next/server";

import { BetaAnalyticsDataClient } from "@google-analytics/data";

import { isAuthenticated } from "../../../lib/auth";



export const runtime = "nodejs";

export const dynamic = "force-dynamic";



type Store = "br" | "en" | "es";



const properties: Record<Store, string> = {

  br: "494454950",

  en: "494483822",

  es: "494471953",

};



const NO_STORE_HEADERS = {

  "Cache-Control": "private, no-store, max-age=0",

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



type DownloadCategory = "3d" | "2d" | "ficha" | "outros";

type CatalogProduct = {
  name: string;
  productId: string;
  reference: string;
  area: string;
  category: string;
  slug: string;
};

type DownloadRecord = {
  name: string;
  path: string;
  pagePath: string;
  category: DownloadCategory;
  count: number;
  product: string;
  area: string;
  productCategory: string;
};

const catalogHosts: Record<Store, string[]> = {
  br: ["https://www.breton.co", "https://secure.breton.com.br"],
  en: ["https://en.breton.co", "https://secure.en.breton.co"],
  es: ["https://es.breton.co", "https://secure.es.breton.co"],
};

// Cache de catálogo em memória por instância; resultados positivos duram uma hora.
const catalogCache = new Map<string, { expires: number; product: CatalogProduct | null }>();

function normalizeProduct(value: string): string {
  return decodeURIComponentSafe(value).normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function decodeURIComponentSafe(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}

function downloadCategory(label: string, filename: string): DownloadCategory {
  const text = normalizeProduct(`${label} ${filename}`);
  if (/(^|-)3d(-|$)/.test(text)) return "3d";
  if (/(^|-)2d(-|$)/.test(text)) return "2d";
  if (/(ficha|commercial-sheet|technical-sheet|fiche-technique|business-profile)/.test(text)) return "ficha";
  return "outros";
}

function pdpSlug(pagePath: string): string {
  // O GA4 pode registrar apenas o path ou uma URL completa com parâmetros.
  let pathname = pagePath;
  try { pathname = new URL(pagePath, "https://www.breton.co").pathname; }
  catch { pathname = pagePath.split("?")[0].split("#")[0]; }
  const match = decodeURIComponentSafe(pathname).match(/^\/([^/]+)\/p\/?$/i);
  return match ? normalizeProduct(match[1]) : "";
}

type VtexEntry = {
  linkText?: string;
  productId?: string | number;
  productName?: string;
  productReference?: string;
  categories?: string[];
  Nome?: string[];
  Name?: string[];
  items?: Array<{ referenceId?: Array<{ Value?: string }>; ean?: string }>;
};

function catalogProductFromEntry(entry: VtexEntry): CatalogProduct | null {
  const path = String(entry.categories?.[0] || "").split("/").filter(Boolean);
  const root = normalizeProduct(path[0] || "");
  const area = ["area-interna", "indoor-area", "zona-interior"].includes(root)
    ? "Área Interna" : ["area-externa", "outdoor-area", "zona-exterior"].includes(root)
      ? "Área Externa" : "Não identificado";
  if (!entry.productId || area === "Não identificado" || !path[1]) return null;
  return {
    name: String(entry.Nome?.[0] || entry.Name?.[0] || entry.productName || entry.linkText || ""),
    productId: String(entry.productId),
    reference: String(entry.productReference || ""),
    area,
    category: path[1],
    slug: normalizeProduct(String(entry.linkText || "")),
  };
}

function referenceMatches(entry: VtexEntry, reference: string): boolean {
  const target = reference.toUpperCase();
  if (String(entry.productReference || "").toUpperCase() === target) return true;
  return (entry.items || []).some(item =>
    String(item.ean || "").toUpperCase() === target ||
    (item.referenceId || []).some(ref => String(ref.Value || "").toUpperCase() === target));
}

// Apenas sufixos com formato de referência; não remover números arbitrários.
function referenceSuffix(slug: string): string {
  const match = slug.match(/-([a-z]{2,}[a-z0-9]*\d[a-z0-9]{4,})$/i);
  return match ? match[1].toUpperCase() : "";
}

const lookupDiagnostics = new Map<string, string>();

async function catalogBySlug(store: Store, slug: string): Promise<CatalogProduct | null> {
  const key = `${store}:${slug}`;
  const cached = catalogCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.product;

  const ref = referenceSuffix(slug);
  const withoutRef = ref ? slug.slice(0, -(ref.length + 1)) : "";
  // A busca VTEX por caminho completo pode retornar [] mesmo quando o produto
  // existe. Ex.: /search/mesa-de-jantar-dandara => [], /search/dandara =>
  // produto cujo linkText é exatamente "mesa-de-jantar-dandara".
  // Usamos o último termo significativo apenas para DESCOBRIR candidatos;
  // nunca classificamos sem validar o linkText ou a referência.
  const canonicalSlug = withoutRef || slug;
  const ignoredTerms = new Set(["de", "da", "do", "das", "dos", "e", "the", "of", "la", "el"]);
  const tokens = canonicalSlug.split("-").filter(token => token.length >= 3 && !ignoredTerms.has(token));
  const searchTerm = tokens[tokens.length - 1] || "";
  const queries = [...new Set([slug, ...(withoutRef ? [withoutRef] : []), ...(searchTerm && searchTerm !== slug && searchTerm !== withoutRef ? [searchTerm] : [])])];
  let product: CatalogProduct | null = null;
  let reason = "Nenhum resultado compatível";

  for (const query of queries) {
    for (const host of catalogHosts[store]) {
      try {
        const url = `${host}/api/catalog_system/pub/products/search/${encodeURIComponent(query)}`;
        const response = await fetch(url, {
          signal: AbortSignal.timeout(7000),
          headers: { Accept: "application/json" },
          next: { revalidate: 3600 },
        });
        if (!response.ok) { reason = `HTTP ${response.status} (${host})`; continue; }
        const json: unknown = await response.json();
        if (!Array.isArray(json)) { reason = `Resposta inválida (${host})`; continue; }
        const entries = json.filter((entry): entry is VtexEntry => !!entry && typeof entry === "object");
        const exact = entries.filter(entry => normalizeProduct(String(entry.linkText || "")) === slug);
        let matched = exact.length === 1 ? exact[0] : undefined;
        // Para URL com referência, o produto pode estar cadastrado com slug
        // canônico sem o sufixo. A referência precisa ser confirmada.
        if (!matched && ref) {
          const byRef = entries.filter(entry => referenceMatches(entry, ref));
          if (byRef.length === 1) matched = byRef[0];
        }
        // Mesmo quando a busca usa só o último termo ("dandara"), a
        // correspondência precisa ser EXATA com o slug original. Para URLs
        // com referência, exigimos também a referência correspondente.
        if (!matched) {
          const canonical = entries.filter(entry => normalizeProduct(String(entry.linkText || "")) === canonicalSlug);
          if (canonical.length === 1 && (!ref || referenceMatches(canonical[0], ref))) matched = canonical[0];
        }
        if (matched) {
          product = catalogProductFromEntry(matched);
          if (product) break;
          reason = "Produto encontrado sem hierarquia de categoria válida";
        } else reason = `Nenhuma correspondência exata ou referência confirmada (${query})`;
      } catch (error) {
        reason = error instanceof Error ? error.message : "Erro de rede";
      }
    }
    if (product) break;
  }
  lookupDiagnostics.set(key, product ? "resolvido" : reason);
  catalogCache.set(key, { product, expires: Date.now() + (product ? 3600000 : 60000) });
  if (catalogCache.size > 10000) catalogCache.clear();
  if (lookupDiagnostics.size > 10000) lookupDiagnostics.clear();
  return product;
}

async function resolveCatalog(store: Store, rows: ReportRow[]) {
  const slugs = [...new Set(rows.map(r => pdpSlug(r.dimensions[2] || "")).filter(Boolean))];
  const resolved = new Map<string, CatalogProduct>();
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(12, slugs.length) }, async () => {
    while (index < slugs.length) {
      const slug = slugs[index++];
      const product = await catalogBySlug(store, slug);
      if (product) resolved.set(slug, product);
    }
  }));
  const missing = new Map<string, { downloads: number; pagePath: string; reason: string }>();
  let matchedDownloads = 0;
  let unmatchedDownloads = 0;
  for (const row of rows) {
    const pagePath = row.dimensions[2] || "";
    const slug = pdpSlug(pagePath);
    const count = row.metrics[0] || 0;
    if (slug && resolved.has(slug)) { matchedDownloads += count; continue; }
    unmatchedDownloads += count;
    const key = slug || `(sem slug) ${pagePath}`;
    const existing = missing.get(key);
    if (existing) existing.downloads += count;
    else missing.set(key, {
      downloads: count,
      pagePath,
      reason: slug ? lookupDiagnostics.get(`${store}:${slug}`) || "Sem correspondência" : "URL não é PDP",
    });
  }
  console.info("Diagnóstico VTEX downloads", JSON.stringify({
    store,
    slugsEncontrados: slugs.length,
    slugsResolvidos: resolved.size,
    downloadsClassificados: matchedDownloads,
    downloadsNaoClassificados: unmatchedDownloads,
    principaisPendencias: [...missing.entries()].map(([slug, value]) => ({ slug, ...value }))
      .sort((a, b) => b.downloads - a.downloads).slice(0, 25),
  }, null, 2));
  return { resolved, limited: false };
}

function summarizeDownloads(rows: ReportRow[], catalog: Map<string, CatalogProduct>, limited: boolean) {
  const files = new Map<string, DownloadRecord>();
  const products = new Map<string, { itemId: string; name: string; area: string; category: string; total: number; d3: number; d2: number; ficha: number; outros: number }>();
  const categories = new Map<string, { area: string; category: string; total: number; d3: number; d2: number; ficha: number; outros: number }>();
  const areas = new Map<string, { area: string; total: number; d3: number; d2: number; ficha: number; outros: number }>();
  const totals = { total: 0, d3: 0, d2: 0, ficha: 0, outros: 0 };
  let unmatched = 0;
  for (const row of rows) {
    const [label = "", filePath = "", pagePath = ""] = row.dimensions;
    const count = row.metrics[0] || 0;
    if (!count) continue;
    const filename = decodeURIComponentSafe(filePath.split("?")[0].split("/").pop() || "");
    // Apenas downloads de produtos com tipo reconhecido e vínculo confirmado na VTEX.
    // Eventos institucionais, guias de cuidados e arquivos sem identificação ficam fora.
    const slug = pdpSlug(pagePath);
    if (!slug) continue;
    const product = catalog.get(slug);
    if (!product) continue;
    const normalizedFile = normalizeProduct(`${label} ${filename} ${filePath}`);
    if (/(^|-)(esg|efeito-estufa|cuidados|guia-de-cuidados|relatorio)(-|$)/.test(normalizedFile)) continue;
    const category = downloadCategory(label, filename);
    if (category === "outros") continue;
    const field = category === "3d" ? "d3" : category === "2d" ? "d2" : "ficha";
    const area = product?.area || "Não identificado";
    const productCategory = product?.category || "Não identificada";
    const productName = product?.name || "Não identificado";
    totals.total += count;
    totals[field] += count;
    if (!product) unmatched += count;
    const fileKey = `${filePath}|${label}|${pagePath}`;
    const file = files.get(fileKey);
    if (file) file.count += count;
    else files.set(fileKey, { name: filename || label || "Arquivo sem nome", path: filePath, pagePath, category, count, product: productName, area, productCategory });
    const areaRow = areas.get(area) || { area, total: 0, d3: 0, d2: 0, ficha: 0, outros: 0 };
    areaRow.total += count; areaRow[field] += count; areas.set(area, areaRow);
    const catKey = `${area}|${productCategory}`;
    const catRow = categories.get(catKey) || { area, category: productCategory, total: 0, d3: 0, d2: 0, ficha: 0, outros: 0 };
    catRow.total += count; catRow[field] += count; categories.set(catKey, catRow);
    if (product) {
      const productKey = product.productId;
      const productRow = products.get(productKey) || { itemId: productKey, name: productName, area, category: productCategory, total: 0, d3: 0, d2: 0, ficha: 0, outros: 0 };
      productRow.total += count; productRow[field] += count; products.set(productKey, productRow);
    }
  }
  const byTotal = <T extends { total: number }>(items: Iterable<T>) => [...items].sort((a, b) => b.total - a.total);
  return { totals, unmatched, limited, files: [...files.values()].sort((a, b) => b.count - a.count), products: byTotal(products.values()), categories: byTotal(categories.values()), areas: byTotal(areas.values()) };
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

  // Proteção independente do proxy.ts.

  // Sem sessão válida, nenhuma consulta ao GA4 é executada.

  if (!isAuthenticated(req)) {

    return NextResponse.json(

      { error: "Não autorizado." },

      {

        status: 401,

        headers: NO_STORE_HEADERS,

      },

    );

  }



  const requestedStore =

    req.nextUrl.searchParams.get("store") || "br";



  if (

    requestedStore !== "br" &&

    requestedStore !== "en" &&

    requestedStore !== "es"

  ) {

    return NextResponse.json(

      { error: "Loja inválida. Utilize br, en ou es." },

      {

        status: 400,

        headers: NO_STORE_HEADERS,

      },

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

      {

        status: 400,

        headers: NO_STORE_HEADERS,

      },

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

      {

        status: 503,

        headers: NO_STORE_HEADERS,

      },

    );

  }



  try {

    const credentials = JSON.parse(raw);



    if (credentials.private_key) {

      credentials.private_key =

        credentials.private_key.replace(/\\\n/g, "\n");

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

eventFilter?: string,

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

          ...(eventFilter ? { dimensionFilter: { filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT" as const, value: eventFilter } } } } : {}),

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

      downloadRows,

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

      report(["linkText", "fileName", "pagePath"], ["eventCount"], start, end, true, "file_download"),

    ]);



    const groupedProducts = groupProducts(items);

    const catalog = await resolveCatalog(store, downloadRows);
  const downloads = summarizeDownloads(downloadRows, catalog.resolved, catalog.limited);

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



    return NextResponse.json(

      {

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



        products: groupedProducts,

        downloads,

      },

      {

        headers: NO_STORE_HEADERS,

      },

    );

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

      {

        status: 502,

        headers: NO_STORE_HEADERS,

      },

    );

  }

}
