
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  ChartNoAxesCombined,
  Network,
  Armchair,
  ShoppingBag,
  Activity,
  MonitorSmartphone,
  CalendarDays,
  Search,
  Menu,
  Download,
  ChevronRight,
  Info,
  ArrowDownUp,
  LoaderCircle,
} from 'lucide-react';

import * as snapshot from '@/lib/snapshot';

type Page = {
  path: string;
  views: number;
};

type Product = {
  name: string;
  views: number;
  quoteAdds: number;
};

type Event = {
  name: string;
  count: number;
};

type Channel = {
  name: string;
  sessions: number;
};

type Data = {
  source: string;
  overview: {
    sessions: number;
    activeUsers: number;
    pageViews: number;
    engagedSessions: number;
    engagementRate: number;
    avgSessionSeconds: number;
  };
  pages: Page[];
  products: Product[];
  events: Event[];
  channels: Channel[];
  devices: Channel[];
  countries: Channel[];
  landings: {
    path: string;
    sessions: number;
  }[];
};

const base: Data = {
  source: 'snapshot',
  overview: {
    sessions: snapshot.overview.sessionsDailySum,
    activeUsers: snapshot.overview.activeUsers,
    pageViews: snapshot.overview.pageViews,
    engagedSessions: snapshot.overview.engagedSessions,
    engagementRate: snapshot.overview.engagementRate,
    avgSessionSeconds: snapshot.overview.avgSessionSeconds,
  },
  pages: snapshot.pages,
  products: snapshot.products,
  events: snapshot.events,
  channels: snapshot.channels,
  devices: snapshot.devices,
  countries: snapshot.countries,
  landings: snapshot.landings,
};

const fmt = (n: number) =>
  new Intl.NumberFormat('pt-BR').format(n);

const pct = (n: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(n);

const nav = [
  { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'acquisition', label: 'Aquisição', icon: ChartNoAxesCombined },
  { id: 'site', label: 'Mapa do site', icon: Network },
  { id: 'products', label: 'Produtos', icon: Armchair },
  { id: 'funnel', label: 'Funil de orçamento', icon: ShoppingBag },
  { id: 'events', label: 'Eventos', icon: Activity },
  {
    id: 'audience',
    label: 'Público e dispositivos',
    icon: MonitorSmartphone,
  },
];

function Card({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | string;
  detail?: string;
}) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <strong>
        {typeof value === 'number' ? fmt(value) : value}
      </strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
  right,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function Bars({
  items,
}: {
  items: { name: string; value: number }[];
}) {
  const top = items.slice(0, 12);
  const max = Math.max(1, ...top.map((x) => x.value));

  return (
    <div className="bars">
      {top.map((x) => (
        <div className="barrow" key={x.name}>
          <span title={x.name}>{x.name}</span>
          <div className="bartrack">
            <div
              className="barfill berry"
              style={{ width: `${(x.value / max) * 100}%` }}
            />
          </div>
          <b>{fmt(x.value)}</b>
        </div>
      ))}
    </div>
  );
}

function csv(
  name: string,
  rows: Record<string, string | number>[],
) {
  if (!rows.length) return;

  const keys = Object.keys(rows[0]);

  const value = (v: unknown) =>
    '"' + String(v ?? '').replaceAll('"', '""') + '"';

  const content =
    '\uFEFF' +
    [
      keys.join(';'),
      ...rows.map((r) =>
        keys.map((k) => value(r[k])).join(';'),
      ),
    ].join('\n');

  const url = URL.createObjectURL(
    new Blob([content], {
      type: 'text/csv;charset=utf-8',
    }),
  );

  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Rotas que não pertencem à navegação PT-BR.
// URLs de produtos /:slug/p são preservadas.

const excludedRoots = new Set([
  'zona-interior',
  'zona-exterior',
  'indoor-area',
  'outdoor-area',
  'corporate',
  'corporate2',
  'indoor',
  'outdoor',
  'interior-area',
  'exterior-area',
  'about-us',
  'about',
  'our-story',
  'designers-en',
  'stores-en',
  'products',
  'product',
  'blog-en',
  'contact-us',
  'area-interior',
  'area-exterior',
  'zona-interna',
  'zona-externa',
]);

function decodeURIComponentSafe(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isPtPath(path: string) {
  const clean = path.split('?')[0].split('#')[0];
  const parts = clean.split('/').filter(Boolean);

  if (!parts.length) return true;

  const first = decodeURIComponentSafe(
    parts[0],
  ).toLocaleLowerCase('pt-BR');

  if (excludedRoots.has(first)) return false;

  if (
    [
      'en',
      'es',
      'en-us',
      'es-es',
      'en-gb',
      'english',
      'espanol',
    ].includes(first)
  ) {
    return false;
  }

  return true;
}

const channelNames: Record<string, string> = {
  'Organic Search': 'Busca orgânica',
  'Paid Search': 'Busca paga',
  Direct: 'Acesso direto',
  'Organic Social': 'Redes sociais (orgânico)',
  'Paid Social': 'Redes sociais (anúncios)',
  Referral: 'Sites de referência',
  Email: 'E-mail',
  'Cross-network': 'Campanhas em várias redes',
  Unassigned: 'Não classificado',
  'AI Assistant': 'Assistentes de inteligência artificial',
  Display: 'Anúncios gráficos',
  'Paid Other': 'Outros anúncios',
  'Organic Video': 'Vídeo orgânico',
  'Paid Video': 'Vídeo pago',
  'Organic Shopping': 'Compras orgânicas',
  'Paid Shopping': 'Anúncios de produtos',
  Affiliates: 'Afiliados',
  Audio: 'Áudio',
  SMS: 'Mensagem de texto',
  'Mobile Push Notifications': 'Notificações no celular',
};

const deviceNames: Record<string, string> = {
  desktop: 'Computador',
  mobile: 'Celular',
  tablet: 'Tablet',
  'smart tv': 'Televisão inteligente',
};

const eventNames: Record<string, string> = {
  page_view: 'Visualização de página',
  view_item_list: 'Visualização de lista de produtos',
  user_engagement: 'Engajamento do usuário',
  view_footer: 'Visualização do rodapé',
  view_search_results: 'Visualização de resultados de busca',
  select_item: 'Seleção de produto',
  view_item: 'Visualização de produto',
  session_start: 'Início de sessão',
  view_promotion: 'Visualização de promoção',
  view_menu: 'Visualização do menu',
  view_item_specs: 'Visualização de especificações',
  select_menu: 'Seleção no menu',
  scroll: 'Rolagem da página',
  form_start: 'Início de formulário',
  form_submit: 'Envio de formulário',
  first_visit: 'Primeira visita',
  select_item_specs: 'Seleção de especificações',
  click: 'Clique',
  view_filter: 'Visualização de filtro',
  file_download: 'Download de arquivo',
  select_filter: 'Seleção de filtro',
  select_top_bar: 'Seleção da barra superior',
  view_item_zoom: 'Ampliação de imagem do produto',
  add_to_cart: 'Adição para orçamento',
  view_cart: 'Visualização da lista de orçamento',
  select_footer: 'Seleção no rodapé',
  select_promotion: 'Seleção de promoção',
  begin_checkout: 'Início da finalização (a revisar)',
  purchase: 'Finalização registrada (a validar)',
  remove_from_cart: 'Remoção da lista de orçamento',
  add_to_wishlist: 'Adição aos favoritos',
};

const translatedChannel = (name: string) =>
  channelNames[name] || name;

const translatedDevice = (name: string) =>
  deviceNames[name.toLowerCase()] || name;

const translatedEvent = (name: string) =>
  eventNames[name] || name.replaceAll('_', ' ');

// Consolida segmentos consecutivos duplicados.

function canonicalPath(path: string) {
  const clean = path.split('?')[0];
  const parts = clean.split('/').filter(Boolean);
  const out: string[] = [];

  for (const part of parts) {
    if (
      out.length &&
      out[out.length - 1].toLocaleLowerCase('pt-BR') ===
        part.toLocaleLowerCase('pt-BR')
    ) {
      continue;
    }

    out.push(part);
  }

  return '/' + out.join('/');
}

function canonicalPages(pages: Page[]) {
  const grouped = new Map<string, number>();

  for (const p of pages) {
    if (
      !p.path ||
      p.path === '(not set)' ||
      !isPtPath(p.path)
    ) {
      continue;
    }

    const path = canonicalPath(p.path);

    grouped.set(
      path,
      (grouped.get(path) || 0) + p.views,
    );
  }

  return [...grouped]
    .map(([path, views]) => ({ path, views }))
    .sort((a, b) => b.views - a.views);
}

type Tree = {
  name: string;
  path: string;
  views: number;
  children: Map<string, Tree>;
};

function makeTree(pages: Page[]) {
  const root: Tree = {
    name: 'breton.co',
    path: '/',
    views: 0,
    children: new Map(),
  };

  for (const p of pages) {
    if (
      !p.path ||
      p.path === '(not set)' ||
      !isPtPath(p.path)
    ) {
      continue;
    }

    const parts = p.path
      .split('?')[0]
      .split('/')
      .filter(Boolean);

    if (!parts.length) {
      root.views += p.views;
      continue;
    }

    let node = root;
    let path = '';

    for (const part of parts) {
      path += '/' + part;

      if (!node.children.has(part)) {
        node.children.set(part, {
          name: part,
          path,
          views: 0,
          children: new Map(),
        });
      }

      node = node.children.get(part)!;
    }

    node.views += p.views;
  }

  return root;
}

function TreeNode({
  node,
  depth,
  onPick,
}: {
  node: Tree;
  depth: number;
  onPick: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth < 2);

  const children = [...node.children.values()].sort(
    (a, b) => {
      const sum = (x: Tree): number =>
        x.views +
        [...x.children.values()].reduce(
          (s, c) => s + sum(c),
          0,
        );

      return sum(b) - sum(a);
    },
  );

  return (
    <div>
      <div
        className="tree-item"
        style={{ paddingLeft: 10 + depth * 15 }}
      >
        <button
          className="tree-toggle"
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Recolher' : 'Expandir'}
        >
          {children.length ? (
            <ChevronRight
              size={14}
              style={{
                transform: open
                  ? 'rotate(90deg)'
                  : undefined,
              }}
            />
          ) : (
            <span style={{ width: 14 }} />
          )}
        </button>

        <button
          className="tree-name"
          onClick={() => onPick(node.path)}
          title={node.path}
        >
          {node.name}
        </button>

        <span>
          {node.views ? fmt(node.views) : ''}
        </span>
      </div>

      {open &&
        children.map((n) => (
          <TreeNode
            key={n.path}
            node={n}
            depth={depth + 1}
            onPick={onPick}
          />
        ))}
    </div>
  );
}

export default function Home() {
  const [tab, setTab] = useState('overview');
  const [start, setStart] = useState(snapshot.period.from);
  const [end, setEnd] = useState(snapshot.period.to);
  const [data, setData] = useState<Data>(base);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'views' | 'quoteAdds'>(
    'views',
  );
  const [menu, setMenu] = useState(false);
  const [showRawPaths, setShowRawPaths] = useState(false);

  async function load(from: string, to: string) {
    if (from > to) {
      setError(
        'A data inicial não pode ser posterior à final.',
      );
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(
        `/api/ga4?start=${from}&end=${to}`,
        { cache: 'no-store' },
      );

      const json = await res.json();

      if (!res.ok) {
        throw Error(json.error || 'Erro na consulta');
      }

      setData(json);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Falha na consulta',
      );

      setData({
        ...base,
        source: 'unavailable',
        pages: [],
        products: [],
        events: [],
        channels: [],
        devices: [],
        countries: [],
        landings: [],
        overview: {
          sessions: 0,
          activeUsers: 0,
          pageViews: 0,
          engagedSessions: 0,
          engagementRate: 0,
          avgSessionSeconds: 0,
        },
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(snapshot.period.from, snapshot.period.to);
  }, []);

  const ev = (name: string) =>
    data.events.find((e) => e.name === name)?.count || 0;

  const sitePages = useMemo(
    () =>
      showRawPaths
        ? data.pages.filter((p) => isPtPath(p.path))
        : canonicalPages(data.pages),
    [data.pages, showRawPaths],
  );

  const pages = useMemo(
    () =>
      sitePages.filter((x) =>
        x.path.toLowerCase().includes(q.toLowerCase()),
      ),
    [sitePages, q],
  );

  const products = useMemo(
    () =>
      data.products
        .filter((x) =>
          x.name.toLowerCase().includes(q.toLowerCase()),
        )
        .sort((a, b) => b[sort] - a[sort]),
    [data.products, q, sort],
  );

  const tree = useMemo(
    () => makeTree(sitePages),
    [sitePages],
  );

  const siteComplete = data.source === 'ga4-live';
  const current = nav.find((n) => n.id === tab)!;

  const table = (
    headers: string[],
    rows: (string | number)[][],
  ) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>
                  {typeof c === 'number' ? fmt(c) : c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  function render() {
    if (tab === 'overview') {
      return (
        <>
          <div className="metrics">
            <Card
              label="Sessões"
              value={data.overview.sessions}
              detail="Visitas iniciadas ao site; uma pessoa pode gerar várias sessões."
            />

            <Card
              label="Usuários ativos"
              value={data.overview.activeUsers}
              detail="Pessoas distintas que tiveram uma sessão engajada ou atividade reconhecida pelo GA4 no período; não é o total de visitas."
            />

            <Card
              label="Visualizações de páginas"
              value={data.overview.pageViews}
              detail="Quantidade de carregamentos de páginas, incluindo repetições."
            />

            <Card
              label="Adições para orçamento"
              value={ev('add_to_cart')}
            />
          </div>

          <div className="two">
            <Section title="Canais de aquisição">
              <Bars
                items={data.channels.map((x) => ({
                  name: translatedChannel(x.name),
                  value: x.sessions,
                }))}
              />
            </Section>

            <Section
              title="Páginas mais acessadas"
              subtitle="Ranking do site inteiro, não apenas da Home"
            >
              <Bars
                items={sitePages.slice(0, 12).map((x) => ({
                  name: x.path,
                  value: x.views,
                }))}
              />
            </Section>
          </div>

          <div className="three">
            <div className="mini">
              <span>Visualizações de produtos</span>
              <strong>{fmt(ev('view_item'))}</strong>
            </div>

            <div className="mini">
              <span>Buscas internas</span>
              <strong>
                {fmt(ev('view_search_results'))}
              </strong>
            </div>

            <div className="mini">
              <span title="Percentual de sessões engajadas no Google Analytics 4">
                Taxa de engajamento
              </span>

              <strong>
                {pct(data.overview.engagementRate)}
              </strong>

              <small
                style={{
                  display: 'block',
                  fontSize: 12,
                  lineHeight: 1.5,
                  marginTop: 8,
                  color: '#777',
                }}
              >
                Sessões com mais de 10 segundos,
                2 ou mais páginas/telas ou um evento
                principal. Não significa orçamento enviado.
              </small>
            </div>
          </div>
        </>
      );
    }

    if (tab === 'site') {
      return (
        <>
          <div className="metrics">
            <Card
              label="Caminhos no período"
              value={sitePages.length}
              detail={
                siteComplete
                  ? 'Todos os caminhos retornados pelo GA4'
                  : 'Amostra histórica: para todas as URLs, configure o acesso ao GA4'
              }
            />

            <Card
              label="Visualizações de páginas"
              value={data.overview.pageViews}
              detail="Quantidade de carregamentos de páginas, incluindo repetições."
            />

            <Card
              label="Página inicial"
              value={
                sitePages.find((p) => p.path === '/')
                  ?.views || 0
              }
            />

            <Card
              label="Páginas filtradas"
              value={pages.length}
            />
          </div>

          <div className="two site-layout">
            <Section
              title="Árvore de URLs"
              subtitle="Apenas rotas PT-BR. Caminhos em outros idiomas são ocultados; URLs históricas não necessariamente existem hoje."
            >
              <div className="tree">
                <div className="tree-root">
                  breton.co
                </div>

                <TreeNode
                  key={
                    data.source +
                    start +
                    end +
                    String(showRawPaths)
                  }
                  node={tree}
                  depth={0}
                  onPick={setQ}
                />
              </div>
            </Section>

            <Section
              title="Todas as páginas e visualizações"
              subtitle={
                siteComplete
                  ? 'Inclui Área Externa, produtos e páginas institucionais com tráfego no período'
                  : 'Amostra histórica incompleta; o mapa integral exige conexão GA4'
              }
              right={
                <button
                  className="ghost"
                  onClick={() =>
                    csv(
                      'breton-paginas.csv',
                      pages.map((x) => ({
                        caminho: x.path,
                        visualizacoes: x.views,
                      })),
                    )
                  }
                >
                  <Download size={15} />
                  CSV
                </button>
              }
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 14,
                  fontSize: 13,
                }}
              >
                <input
                  type="checkbox"
                  checked={showRawPaths}
                  onChange={(e) =>
                    setShowRawPaths(e.target.checked)
                  }
                />

                Exibir caminhos originais do GA4
                (sem consolidar duplicações)
              </label>

              <div className="search">
                <Search size={16} />

                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar /area-externa, /corporativo, /designers..."
                />
              </div>

              {table(
                ['Caminho', 'Visualizações'],
                pages.map((x) => [x.path, x.views]),
              )}
            </Section>
          </div>

          <p className="footnote">
            Rotas em outros idiomas (como
            /zona-interior, /zona-exterior,
            /indoor-area e /corporate2) são ocultadas.
            URLs de produtos são preservadas.
            O mapa representa caminhos com visualizações
            no período, não o sitemap de produção.
            Por padrão, segmentos consecutivos repetidos
            são consolidados e suas visualizações somadas.
            Ative caminhos originais para auditar duplicações.
            URLs sem tráfego não aparecem.
          </p>
        </>
      );
    }

    if (tab === 'acquisition') {
      return (
        <>
          <div className="metrics">
            <Card
              label="Sessões"
              value={data.overview.sessions}
              detail="Visitas iniciadas ao site; uma pessoa pode gerar várias sessões."
            />

            <Card
              label="Busca orgânica"
              value={
                data.channels.find((x) =>
                  /Organic Search|Busca orgânica/.test(
                    x.name,
                  ),
                )?.sessions || 0
              }
            />

            <Card
              label="Direto"
              value={
                data.channels.find((x) =>
                  /Direct|Direto/.test(x.name),
                )?.sessions || 0
              }
            />

            <Card
              label="Não atribuído"
              value={
                data.channels.find((x) =>
                  /Unassigned|Não atribuído/.test(
                    x.name,
                  ),
                )?.sessions || 0
              }
            />
          </div>

          <div className="two">
            <Section title="Canais de aquisição">
              <Bars
                items={data.channels.map((x) => ({
                  name: translatedChannel(x.name),
                  value: x.sessions,
                }))}
              />
            </Section>

            <Section title="Páginas de entrada">
              <Bars
                items={data.landings.map((x) => ({
                  name: x.path,
                  value: x.sessions,
                }))}
              />
            </Section>
          </div>
        </>
      );
    }

    if (tab === 'products') {
      return (
        <>
          <div className="metrics">
            <Card
              label="Visualizações de produtos"
              value={ev('view_item')}
            />

            <Card
              label="Seleções em listas"
              value={ev('select_item')}
            />

            <Card
              label="Adições para orçamento"
              value={ev('add_to_cart')}
            />

            <Card
              label="Produtos no relatório"
              value={data.products.length}
            />
          </div>

          <Section
            title="Ranking de produtos"
            subtitle={
              siteComplete
                ? 'Todos os itens retornados pelo GA4 no período'
                : 'Amostra inicial de produtos'
            }
            right={
              <button
                className="ghost"
                onClick={() =>
                  csv(
                    'breton-produtos.csv',
                    products.map((x) => ({
                      produto: x.name,
                      visualizacoes: x.views,
                      adicoes_orcamento: x.quoteAdds,
                    })),
                  )
                }
              >
                <Download size={15} />
                CSV
              </button>
            }
          >
            <div className="toolbar">
              <div className="search">
                <Search size={16} />

                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Pesquisar produto"
                />
              </div>

              <button
                className="sort"
                onClick={() =>
                  setSort(
                    sort === 'views'
                      ? 'quoteAdds'
                      : 'views',
                  )
                }
              >
                <ArrowDownUp size={15} />

                {sort === 'views'
                  ? 'Mais visualizados'
                  : 'Mais adicionados'}
              </button>
            </div>

            {table(
              [
                'Produto',
                'Visualizações',
                'Adições para orçamento',
                'Adições / visualizações*',
              ],
              products.map((x) => [
                x.name,
                x.views,
                x.quoteAdds,
                x.views
                  ? pct(x.quoteAdds / x.views)
                  : 'Não calculável',
              ]),
            )}

            <p className="footnote">
              * Razão entre contagens de eventos,
              não conversão de pessoas. Quando há zero
              visualizações, a razão não pode ser calculada.
              Adições sem visualizações podem indicar ações
              em listagens ou diferenças no rastreamento
              dos eventos view_item e add_to_cart.
            </p>
          </Section>
        </>
      );
    }

    if (tab === 'funnel') {
      const funnelEvents = [
        ['Visualização de produto', 'view_item'],
        ['Adição para orçamento', 'add_to_cart'],
        ['Visualização do carrinho', 'view_cart'],
        ['Início do checkout (a revisar)', 'begin_checkout'],
        ['Finalização registrada (a validar)', 'purchase'],
      ];

      return (
        <>
          <div className="metrics">
            <Card
              label="Visualizações de produto"
              value={ev('view_item')}
            />

            <Card
              label="Adições para orçamento"
              value={ev('add_to_cart')}
            />

            <Card
              label="Visualizações do carrinho"
              value={ev('view_cart')}
            />

            <Card
              label="Inícios de finalização"
              value={ev('begin_checkout')}
              detail="Evento begin_checkout do GA4. Sua correspondência com o fluxo de orçamento da Breton ainda precisa ser validada."
            />
          </div>

          <Section
            title="Eventos do fluxo comercial"
            subtitle="Contagens independentes, não uma conversão sequencial por usuário"
          >
            <div className="funnel">
              {funnelEvents.map(
                ([label, event], i) => (
                  <div
                    className="funnel-row"
                    key={event}
                  >
                    <div className="funnel-num">
                      0{i + 1}
                    </div>

                    <div className="funnel-body">
                      <div className="funnel-label">
                        <span>
                          {label}

                          <small>
                            {translatedEvent(event)}
                          </small>
                        </span>

                        <b>{fmt(ev(event))}</b>
                      </div>

                      <div className="funnel-track">
                        <div
                          style={{
                            width: `${
                              Math.max(
                                1,
                                (100 * ev(event)) /
                                  Math.max(
                                    1,
                                    ev('view_item'),
                                  ),
                              )
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>

            <div className="note">
              <Info size={17} />

              <span>
                O botão “Solicitar orçamento” dispara
                o evento add_to_cart, mas isso não
                comprova o envio de um orçamento.
                <strong> A revisar: </strong>
                begin_checkout indica o início de uma
                etapa de finalização registrada no GA4,
                enquanto purchase indica uma finalização
                registrada. Precisamos validar quais
                ações reais do site Breton disparam
                esses eventos antes de considerá-los
                orçamentos concluídos.
              </span>
            </div>
          </Section>
        </>
      );
    }

    if (tab === 'events') {
      return (
        <>
          <div className="metrics">
            <Card
              label="Tipos de evento"
              value={data.events.length}
            />

            <Card
              label="Arquivos baixados"
              value={ev('file_download')}
            />

            <Card
              label="Interações com filtros"
              value={ev('select_filter')}
            />

            <Card
              label="Zoom de produto"
              value={ev('view_item_zoom')}
            />
          </div>

          <Section
            title="Inventário de eventos"
            subtitle="Nomes apresentados em português; os identificadores técnicos permanecem disponíveis na exportação."
            right={
              <button
                className="ghost"
                onClick={() =>
                  csv(
                    'breton-eventos.csv',
                    data.events.map((x) => ({
                      evento: translatedEvent(x.name),
                      identificador_ga4: x.name,
                      ocorrencias: x.count,
                    })),
                  )
                }
              >
                <Download size={15} />
                CSV
              </button>
            }
          >
            {table(
              ['Evento', 'Ocorrências'],
              [...data.events]
                .sort((a, b) => b.count - a.count)
                .map((x) => [
                  translatedEvent(x.name),
                  x.count,
                ]),
            )}
          </Section>
        </>
      );
    }

    return (
      <>
        <div className="metrics">
          <Card
            label="Usuários ativos"
            value={data.overview.activeUsers}
            detail="Pessoas distintas que tiveram uma sessão engajada ou atividade reconhecida pelo GA4 no período; não é o total de visitas."
          />

          <Card
            label="Sessões engajadas"
            value={data.overview.engagedSessions}
            detail="Visitas que atenderam a pelo menos um critério de engajamento do GA4."
          />

          <Card
            label="Taxa de engajamento"
            value={pct(data.overview.engagementRate)}
            detail="Percentual de sessões com mais de 10 segundos, 2 ou mais páginas/telas ou um evento principal configurado no GA4. Não representa necessariamente um orçamento enviado."
          />

          <Card
            label="Duração média da sessão"
            value={`${(
              data.overview.avgSessionSeconds / 60
            ).toFixed(1)} min`}
          />
        </div>

        <div className="two">
          <Section title="Dispositivos">
            <Bars
              items={data.devices.map((x) => ({
                name: translatedDevice(x.name),
                value: x.sessions,
              }))}
            />
          </Section>

          <Section title="Países">
            <Bars
              items={data.countries.map((x) => ({
                name: x.name,
                value: x.sessions,
              }))}
            />
          </Section>
        </div>
      </>
    );
  }

  return (
    <div className="app">
      <aside
        className={
          'sidebar ' + (menu ? 'open' : '')
        }
      >
        <div className="brand">
          <div className="brand-mark">B</div>

          <div>
            <strong>BRETON</strong>
            <small>INTELLIGENCE</small>
          </div>
        </div>

        <div className="side-caption">
          PAINEL DE ANÁLISE
        </div>

        <nav>
          {nav.map((n) => {
            const Icon = n.icon;

            return (
              <button
                key={n.id}
                className={
                  tab === n.id ? 'active' : ''
                }
                onClick={() => {
                  setTab(n.id);
                  setQ('');
                  setMenu(false);
                }}
              >
                <Icon size={18} />
                {n.label}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="source-dot" />

          <div>
            <strong>
              Google Analytics · Breton.co
            </strong>

            <small>
              Propriedade 494454950
            </small>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setMenu(!menu)}
          >
            <Menu size={21} />
          </button>

          <div className="breadcrumb">
            Análises
            <ChevronRight size={15} />
            <span>{current.label}</span>
          </div>

          <div className="topright">
            <span className="snapshot-pill">
              <span />

              {loading
                ? 'Consultando GA4'
                : data.source === 'ga4-live'
                  ? 'Dados atualizados do GA4'
                  : 'Sem dados'}
            </span>
          </div>
        </header>

        <div className="content">
          <div className="intro">
            <div>
              <div className="eyebrow">
                BRETON / DESEMPENHO DIGITAL
              </div>

              <h1>{current.label}</h1>

              <p>
                Propriedade GA4 494454950 ·
                dados de acordo com o período selecionado
              </p>
            </div>
          </div>

          <form
            className="date-controls"
            onSubmit={(e) => {
              e.preventDefault();
              setQ('');
              load(start, end);
            }}
          >
            <CalendarDays size={17} />

            <label>
              De{' '}
              <input
                aria-label="Data inicial"
                type="date"
                value={start}
                max={end}
                onChange={(e) =>
                  setStart(e.target.value)
                }
              />
            </label>

            <label>
              Até{' '}
              <input
                aria-label="Data final"
                type="date"
                value={end}
                min={start}
                onChange={(e) =>
                  setEnd(e.target.value)
                }
              />
            </label>

            <button
              disabled={loading}
              type="submit"
            >
              {loading
                ? 'Consultando...'
                : 'Aplicar período'}
            </button>
          </form>

          {!loading && error && (
            <div className="note">
              <Info size={17} />

              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div
              role="status"
              aria-live="polite"
              style={{
                minHeight: 320,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                color: '#7e2a43',
              }}
            >
              <style>
                {
                  '@keyframes bretonSpin {to {transform:rotate(360deg)}}'
                }
              </style>

              <LoaderCircle
                size={36}
                style={{
                  animation:
                    'bretonSpin 1s linear infinite',
                }}
              />

              <strong>
                Buscando dados do Google Analytics...
              </strong>

              <span
                style={{
                  color: '#777',
                  fontSize: 13,
                }}
              >
                Consultando o período selecionado.
                Aguarde.
              </span>
            </div>
          ) : data.source === 'unavailable' ? (
            <Section
              title="Sem dados para este período"
              subtitle="Não foi possível consultar os dados do GA4."
            >
              <p>
                Verifique as credenciais de leitura
                do GA4 no servidor e as permissões
                da conta de serviço.
              </p>

              <p>
                No ambiente local, as credenciais
                ficam em <code>.env.local</code>.
                Na Vercel, devem estar configuradas
                nas variáveis de ambiente do projeto.
              </p>
            </Section>
          ) : (
            render()
          )}

          <footer>
            Breton Intelligence ·{' '}
            {loading
              ? 'Consultando dados...'
              : data.source === 'ga4-live'
                ? `Dados atualizados do GA4 · ${start} a ${end}`
                : 'Consulta indisponível'}
          </footer>
        </div>
      </main>

      {menu && (
        <div
          className="scrim"
          onClick={() => setMenu(false)}
        />
      )}
    </div>
  );
}
