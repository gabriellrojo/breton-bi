
'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

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

type Store = 'br' | 'en' | 'es';

type Page = {
  path: string;
  views: number;
};

type Product = {
  itemId?: string;
  name: string;
  views: number;
  quoteAdds: number;
  aliases?: string[];
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
  store?: Store;
  property?: string;
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

const stores: Record<
  Store,
  {
    label: string;
    domain: string;
    property: string;
  }
> = {
  br: {
    label: 'Brasil',
    domain: 'www.breton.co',
    property: '494454950',
  },
  en: {
    label: 'Inglês',
    domain: 'en.breton.co',
    property: '494483822',
  },
  es: {
    label: 'Espanhol',
    domain: 'es.breton.co',
    property: '494471953',
  },
};

const base: Data = {
  source: 'snapshot',
  store: 'br',
  property: stores.br.property,
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

function emptyData(store: Store): Data {
  return {
    source: 'unavailable',
    store,
    property: stores[store].property,
    overview: {
      sessions: 0,
      activeUsers: 0,
      pageViews: 0,
      engagedSessions: 0,
      engagementRate: 0,
      avgSessionSeconds: 0,
    },
    pages: [],
    products: [],
    events: [],
    channels: [],
    devices: [],
    countries: [],
    landings: [],
  };
}

const fmt = (n: number) =>
  new Intl.NumberFormat('pt-BR').format(n);

const pct = (n: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(n);

const nav = [
  {
    id: 'overview',
    label: 'Visão geral',
    icon: LayoutDashboard,
  },
  {
    id: 'acquisition',
    label: 'Origem dos visitantes',
    icon: ChartNoAxesCombined,
  },
  {
    id: 'site',
    label: 'Mapa do site',
    icon: Network,
  },
  {
    id: 'products',
    label: 'Produtos',
    icon: Armchair,
  },
  {
    id: 'funnel',
    label: 'Funil de orçamento',
    icon: ShoppingBag,
  },
  {
    id: 'events',
    label: 'Eventos',
    icon: Activity,
  },
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
  children: ReactNode;
  right?: ReactNode;
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
  items: {
    name: string;
    value: number;
  }[];
}) {
  const top = items.slice(0, 12);
  const max = Math.max(1, ...top.map((item) => item.value));

  return (
    <div className="bars">
      {top.map((item, index) => (
        <div
          className="barrow"
          key={`${item.name}-${index}`}
        >
          <span title={item.name}>{item.name}</span>

          <div className="bartrack">
            <div
              className="barfill berry"
              style={{
                width: `${(item.value / max) * 100}%`,
              }}
            />
          </div>

          <b>{fmt(item.value)}</b>
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
      ...rows.map((row) =>
        keys.map((key) => value(row[key])).join(';'),
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

const excludedRootsByStore: Record<
  Store,
  Set<string>
> = {
  br: new Set([
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
  ]),

  en: new Set([
    'area-interna',
    'area-externa',
    'zona-interior',
    'zona-exterior',
    'corporativo',
    'corporate2',
    'zona-interna',
    'zona-externa',
    'sobre-nos',
    'contato',
  ]),

  es: new Set([
    'area-interna',
    'area-externa',
    'indoor-area',
    'outdoor-area',
    'corporativo',
    'corporate',
    'corporate2',
    'sobre-nos',
    'about-us',
  ]),
};

function decodeURIComponentSafe(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isStorePath(
  path: string,
  store: Store,
) {
  const clean = path
    .split('?')[0]
    .split('#')[0];

  const parts = clean.split('/').filter(Boolean);

  if (!parts.length) return true;

  const first = decodeURIComponentSafe(
    parts[0],
  ).toLocaleLowerCase('pt-BR');

  if (excludedRootsByStore[store].has(first)) {
    return false;
  }

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
  'Organic Search': 'Pesquisa orgânica',
  'Paid Search': 'Pesquisa paga',
  Direct: 'Acesso direto',
  'Organic Social': 'Redes sociais (orgânico)',
  'Paid Social': 'Redes sociais (anúncios)',
  Referral: 'Links de outros sites',
  Email: 'E-mail',
  'Cross-network': 'Campanhas em várias redes',
  Unassigned: 'Canal não classificado',
  '(not set)': 'Origem não identificada',
  'AI Assistant':
    'Assistentes de inteligência artificial',
  Display: 'Anúncios gráficos',
  'Paid Other': 'Outros anúncios',
  'Organic Video': 'Vídeo orgânico',
  'Paid Video': 'Vídeo pago',
  'Organic Shopping': 'Compras orgânicas',
  'Paid Shopping': 'Anúncios de produtos',
  Affiliates: 'Afiliados',
  Audio: 'Áudio',
  SMS: 'Mensagem de texto',
  'Mobile Push Notifications':
    'Notificações no celular',
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
  view_search_results:
    'Visualização de resultados de busca',
  select_item: 'Seleção de produto',
  view_item: 'Visualização de produto',
  session_start: 'Início de sessão',
  view_promotion: 'Visualização de promoção',
  view_menu: 'Visualização do menu',
  view_item_specs:
    'Visualização de especificações',
  select_menu: 'Seleção no menu',
  scroll: 'Rolagem da página',
  form_start: 'Início de formulário',
  form_submit: 'Envio de formulário',
  first_visit: 'Primeira visita',
  select_item_specs:
    'Seleção de especificações',
  click: 'Clique',
  view_filter: 'Visualização de filtro',
  file_download: 'Download de arquivo',
  select_filter: 'Seleção de filtro',
  select_top_bar: 'Seleção da barra superior',
  view_item_zoom:
    'Ampliação de imagem do produto',
  add_to_cart: 'Adição para orçamento',
  view_cart:
    'Visualização da lista de orçamento',
  select_footer: 'Seleção no rodapé',
  select_promotion: 'Seleção de promoção',
  begin_checkout:
    'Início da finalização (a revisar)',
  purchase:
    'Finalização registrada (a validar)',
  remove_from_cart:
    'Remoção da lista de orçamento',
  add_to_wishlist: 'Adição aos favoritos',
};

const translatedChannel = (name: string) =>
  channelNames[name] || name;

const translatedDevice = (name: string) =>
  deviceNames[name.toLowerCase()] || name;

const translatedEvent = (name: string) =>
  eventNames[name] || name.replaceAll('_', ' ');

const translatedLanding = (path: string) => {
  if (!path || path === '(not set)') {
    return 'Página de entrada não identificada';
  }

  return path;
};

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

function canonicalPages(
  pages: Page[],
  store: Store,
) {
  const grouped = new Map<string, number>();

  for (const page of pages) {
    if (
      !page.path ||
      page.path === '(not set)' ||
      !isStorePath(page.path, store)
    ) {
      continue;
    }

    const path = canonicalPath(page.path);

    grouped.set(
      path,
      (grouped.get(path) || 0) + page.views,
    );
  }

  return [...grouped]
    .map(([path, views]) => ({
      path,
      views,
    }))
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

  for (const page of pages) {
    if (
      !page.path ||
      page.path === '(not set)'
    ) {
      continue;
    }

    const parts = page.path
      .split('?')[0]
      .split('/')
      .filter(Boolean);

    if (!parts.length) {
      root.views += page.views;
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

    node.views += page.views;
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
      const sum = (item: Tree): number =>
        item.views +
        [...item.children.values()].reduce(
          (total, child) =>
            total + sum(child),
          0,
        );

      return sum(b) - sum(a);
    },
  );

  return (
    <div>
      <div
        className="tree-item"
        style={{
          paddingLeft: 10 + depth * 15,
        }}
      >
        <button
          className="tree-toggle"
          onClick={() => setOpen(!open)}
          aria-label={
            open ? 'Recolher' : 'Expandir'
          }
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
          {node.views
            ? fmt(node.views)
            : ''}
        </span>
      </div>

      {open &&
        children.map((child) => (
          <TreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            onPick={onPick}
          />
        ))}
    </div>
  );
}

export default function Home() {
  const [store, setStore] = useState<Store>('br');
  const [tab, setTab] = useState('overview');

  const [start, setStart] = useState(
    snapshot.period.from,
  );

  const [end, setEnd] = useState(
    snapshot.period.to,
  );

  const [data, setData] = useState<Data>(base);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const [sort, setSort] = useState<
    'views' | 'quoteAdds'
  >('views');

  const [menu, setMenu] = useState(false);

  const [showRawPaths, setShowRawPaths] =
    useState(false);

  const requestRef = useRef<AbortController | null>(
    null,
  );

  async function load(
    selectedStore: Store,
    from: string,
    to: string,
  ) {
    if (!from || !to || from > to) {
      setError(
        'A data inicial não pode ser posterior à final.',
      );
      return;
    }

    requestRef.current?.abort();

    const controller = new AbortController();
    requestRef.current = controller;

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        store: selectedStore,
        start: from,
        end: to,
      });

      const res = await fetch(
        `/api/ga4?${params.toString()}`,
        {
          cache: 'no-store',
          signal: controller.signal,
        },
      );

      const json = await res.json();

      if (!res.ok) {
        throw Error(
          json.error || 'Erro na consulta',
        );
      }

      if (!controller.signal.aborted) {
        setData(json);
      }
    } catch (err) {
      if (controller.signal.aborted) return;

      setError(
        err instanceof Error
          ? err.message
          : 'Falha na consulta',
      );

      setData(emptyData(selectedStore));
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    load(store, start, end);

    return () => {
      requestRef.current?.abort();
    };

    // O período é aplicado pelo formulário.
    // A troca de loja dispara nova consulta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  const ev = (name: string) =>
    data.events.find(
      (event) => event.name === name,
    )?.count || 0;

  const sitePages = useMemo(
    () =>
      showRawPaths
        ? data.pages.filter(
            (page) =>
              page.path &&
              page.path !== '(not set)' &&
              isStorePath(page.path, store),
          )
        : canonicalPages(data.pages, store),
    [data.pages, showRawPaths, store],
  );

  const pages = useMemo(
    () =>
      sitePages.filter((page) =>
        page.path
          .toLowerCase()
          .includes(q.toLowerCase()),
      ),
    [sitePages, q],
  );

  const products = useMemo(
    () =>
      data.products
        .filter((product) => {
          const search = q.toLowerCase();

          return (
            product.name
              .toLowerCase()
              .includes(search) ||
            product.itemId
              ?.toLowerCase()
              .includes(search) ||
            product.aliases?.some((alias) =>
              alias
                .toLowerCase()
                .includes(search),
            )
          );
        })
        .sort(
          (a, b) =>
            b[sort] - a[sort],
        ),
    [data.products, q, sort],
  );

  const tree = useMemo(
    () => makeTree(sitePages),
    [sitePages],
  );

  const siteComplete =
    data.source === 'ga4-live';

  const current =
    nav.find((item) => item.id === tab)!;

  const currentStore = stores[store];

  const friendlyChannels = useMemo(
    () =>
      data.channels.map((channel) => ({
        name: translatedChannel(
          channel.name,
        ),
        value: channel.sessions,
      })),
    [data.channels],
  );

  const friendlyLandings = useMemo(
    () =>
      data.landings
        .filter(
          (landing) =>
            landing.path &&
            landing.path.trim().toLowerCase() !== '(not set)',
        )
        .map((landing) => ({
          name: landing.path,
          value: landing.sessions,
        })),
    [data.landings],
  );

  const channelSessions = (
    ...names: string[]
  ) =>
    data.channels
      .filter((channel) =>
        names.includes(channel.name),
      )
      .reduce(
        (sum, channel) =>
          sum + channel.sessions,
        0,
      );

  const table = (
    headers: string[],
    rows: (string | number)[][],
  ) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map(
                (cell, cellIndex) => (
                  <td key={cellIndex}>
                    {typeof cell === 'number'
                      ? fmt(cell)
                      : cell}
                  </td>
                ),
              )}
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
              value={
                data.overview.sessions
              }
              detail="Visitas iniciadas ao site; uma pessoa pode gerar várias sessões."
            />

            <Card
              label="Usuários ativos"
              value={
                data.overview.activeUsers
              }
              detail="Pessoas distintas que tiveram uma sessão engajada ou atividade reconhecida pelo GA4 no período."
            />

            <Card
              label="Visualizações de páginas"
              value={
                data.overview.pageViews
              }
              detail="Quantidade de carregamentos de páginas, incluindo repetições."
            />

            <Card
              label="Adições para orçamento"
              value={ev('add_to_cart')}
            />
          </div>

          <div className="two">
            <Section
              title="De onde vêm os visitantes?"
              subtitle="Sessões agrupadas pelo canal de origem."
            >
              <Bars
                items={
                  friendlyChannels
                }
              />
            </Section>

            <Section
              title="Páginas mais acessadas"
              subtitle={`Ranking de páginas da loja ${currentStore.label}`}
            >
              <Bars
                items={sitePages
                  .slice(0, 12)
                  .map((page) => ({
                    name: page.path,
                    value: page.views,
                  }))}
              />
            </Section>
          </div>

          <div className="three">
            <div className="mini">
              <span>
                Visualizações de produtos
              </span>

              <strong>
                {fmt(ev('view_item'))}
              </strong>
            </div>

            <div className="mini">
              <span>
                Buscas internas
              </span>

              <strong>
                {fmt(
                  ev('view_search_results'),
                )}
              </strong>
            </div>

            <div className="mini">
              <span>
                Taxa de engajamento
              </span>

              <strong>
                {pct(
                  data.overview
                    .engagementRate,
                )}
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
                Sessões com mais de 10
                segundos, 2 ou mais
                páginas/telas ou um
                evento principal.
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
              value={
                sitePages.length
              }
              detail="Caminhos retornados pelo GA4 após os filtros do mapa."
            />

            <Card
              label="Visualizações de páginas"
              value={
                data.overview.pageViews
              }
              detail="Total do GA4, incluindo caminhos ocultados pelos filtros do mapa."
            />

            <Card
              label="Página inicial"
              value={
                sitePages.find(
                  (page) =>
                    page.path === '/',
                )?.views || 0
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
              subtitle={`Estrutura de caminhos da loja ${currentStore.label} (${currentStore.domain}).`}
            >
              <div className="tree">
                <div className="tree-root">
                  {currentStore.domain}
                </div>

                <TreeNode
                  key={
                    store +
                    data.source +
                    start +
                    end +
                    String(
                      showRawPaths,
                    )
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
                  ? `Páginas registradas na propriedade GA4 da loja ${currentStore.label}`
                  : 'Dados indisponíveis para o período'
              }
              right={
                <button
                  className="ghost"
                  onClick={() =>
                    csv(
                      `breton-${store}-paginas.csv`,
                      pages.map(
                        (page) => ({
                          caminho:
                            page.path,
                          visualizacoes:
                            page.views,
                        }),
                      ),
                    )
                  }
                >
                  <Download
                    size={15}
                  />
                  CSV
                </button>
              }
            >
              <label
                style={{
                  display: 'flex',
                  alignItems:
                    'center',
                  gap: 8,
                  marginBottom: 14,
                  fontSize: 13,
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    showRawPaths
                  }
                  onChange={(
                    event,
                  ) =>
                    setShowRawPaths(
                      event.target
                        .checked,
                    )
                  }
                />

                Exibir caminhos originais
                do GA4 (sem consolidar
                duplicações)
              </label>

              <div className="search">
                <Search
                  size={16}
                />

                <input
                  value={q}
                  onChange={(
                    event,
                  ) =>
                    setQ(
                      event.target
                        .value,
                    )
                  }
                  placeholder={
                    store === 'br'
                      ? 'Buscar /area-externa, /corporativo, /designers...'
                      : store === 'en'
                        ? 'Buscar /indoor-area, /outdoor-area, /corporate...'
                        : 'Buscar /zona-interior, /zona-exterior, /productos...'
                  }
                />
              </div>

              {table(
                [
                  'Caminho',
                  'Visualizações',
                ],
                pages.map(
                  (page) => [
                    page.path,
                    page.views,
                  ],
                ),
              )}
            </Section>
          </div>

          <p className="footnote">
            O mapa mostra as URLs
            registradas na propriedade
            GA4 selecionada.
            Na loja brasileira,
            são priorizadas as rotas
            em português. Na loja
            inglesa, são preservadas
            as rotas /indoor-area,
            /outdoor-area e /corporate.
            Na loja espanhola,
            são preservadas as rotas
            /zona-interior e
            /zona-exterior.
            As URLs de produtos são
            mantidas. O mapa representa
            caminhos com visualizações
            no período, não o sitemap
            de produção. URLs sem
            tráfego não aparecem.
            Segmentos consecutivos
            repetidos são consolidados
            por padrão; ative os
            caminhos originais para
            investigar duplicações.
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
              value={
                data.overview.sessions
              }
              detail="Total de visitas iniciadas no período."
            />

            <Card
              label="Pesquisa orgânica"
              value={channelSessions(
                'Organic Search',
                'Busca orgânica',
              )}
              detail="Visitas provenientes de resultados não pagos de buscadores."
            />

            <Card
              label="Acesso direto"
              value={channelSessions(
                'Direct',
                'Acesso direto',
              )}
              detail="Visitas classificadas pelo GA4 como acesso direto."
            />

            <Card
              label="Origem não identificada"
              value={channelSessions(
                '(not set)',
                'Origem não identificada',
              )}
              detail="Sessões sem valor de canal informado pelo GA4."
            />
          </div>

          <div className="two">
            <Section
              title="De onde vêm os visitantes?"
              subtitle="Sessões por canal de aquisição."
            >
              <Bars
                items={
                  friendlyChannels
                }
              />
            </Section>

            <Section
              title="Por quais páginas os visitantes chegam?"
              subtitle="áginas de entrada identificadas pelo Google Analytics, ordenadas pelo número de sessões."
            >
              <Bars
                items={
                  friendlyLandings
                }
              />
            </Section>
          </div>

          <p className="footnote">
            Os canais representam
            a classificação de
            aquisição de sessões
            do Google Analytics 4.
            “Canal não classificado”
            e “Origem não identificada”
            são situações distintas
            e permanecem contabilizadas.
            Os nomes foram traduzidos
            apenas para facilitar
            a leitura do relatório.
          </p>
        </>
      );
    }

    if (tab === 'products') {
      return (
        <>
          <div className="metrics">
            <Card
              label="Visualizações de produtos"
              value={
                ev('view_item')
              }
            />

            <Card
              label="Seleções em listas"
              value={
                ev('select_item')
              }
            />

            <Card
              label="Adições para orçamento"
              value={
                ev('add_to_cart')
              }
            />

            <Card
              label="Produtos no relatório"
              value={
                data.products.length
              }
            />
          </div>

          <Section
            title="Ranking de produtos"
            subtitle={`Itens da propriedade GA4 da loja ${currentStore.label}, consolidados por itemId`}
            right={
              <button
                className="ghost"
                onClick={() =>
                  csv(
                    `breton-${store}-produtos.csv`,
                    products.map(
                      (product) => ({
                        item_id:
                          product.itemId ||
                          '',
                        produto:
                          product.name,
                        nomes_alternativos:
                          product.aliases
                            ?.join(
                              ' | ',
                            ) ||
                          '',
                        visualizacoes:
                          product.views,
                        adicoes_orcamento:
                          product.quoteAdds,
                      }),
                    ),
                  )
                }
              >
                <Download
                  size={15}
                />
                CSV
              </button>
            }
          >
            <div className="toolbar">
              <div className="search">
                <Search
                  size={16}
                />

                <input
                  value={q}
                  onChange={(
                    event,
                  ) =>
                    setQ(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Pesquisar produto"
                />
              </div>

              <button
                className="sort"
                onClick={() =>
                  setSort(
                    sort ===
                      'views'
                      ? 'quoteAdds'
                      : 'views',
                  )
                }
              >
                <ArrowDownUp
                  size={15}
                />

                {sort ===
                'views'
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
              products.map(
                (product) => [
                  product.name,
                  product.views,
                  product.quoteAdds,
                  product.views
                    ? pct(
                        product.quoteAdds /
                          product.views,
                      )
                    : 'Não calculável',
                ],
              ),
            )}

            <p className="footnote">
              * Razão entre contagens
              de eventos, não conversão
              de pessoas. Quando há
              zero visualizações, a
              razão não pode ser
              calculada. Adições sem
              visualizações podem
              indicar diferenças no
              rastreamento dos eventos
              view_item e add_to_cart.
              Nomes alternativos
              associados ao mesmo
              identificador são
              consolidados pela API.
              Produtos de lojas
              diferentes não são
              misturados.
            </p>
          </Section>
        </>
      );
    }

    if (tab === 'funnel') {
      const funnelEvents = [
        [
          'Visualização de produto',
          'view_item',
        ],
        [
          'Adição para orçamento',
          'add_to_cart',
        ],
        [
          'Visualização do carrinho',
          'view_cart',
        ],
        [
          'Início do checkout (a revisar)',
          'begin_checkout',
        ],
        [
          'Finalização registrada (a validar)',
          'purchase',
        ],
      ];

      return (
        <>
          <div className="metrics">
            <Card
              label="Visualizações de produto"
              value={
                ev('view_item')
              }
            />

            <Card
              label="Adições para orçamento"
              value={
                ev('add_to_cart')
              }
            />

            <Card
              label="Visualizações do carrinho"
              value={
                ev('view_cart')
              }
            />

            <Card
              label="Inícios de finalização"
              value={
                ev('begin_checkout')
              }
              detail="Evento begin_checkout do GA4. Sua correspondência com o fluxo de orçamento ainda precisa ser validada."
            />
          </div>

          <Section
            title="Eventos do fluxo comercial"
            subtitle="Contagens independentes, não uma conversão sequencial por usuário"
          >
            <div className="funnel">
              {funnelEvents.map(
                (
                  [label, event],
                  index,
                ) => (
                  <div
                    className="funnel-row"
                    key={event}
                  >
                    <div className="funnel-num">
                      0
                      {index + 1}
                    </div>

                    <div className="funnel-body">
                      <div className="funnel-label">
                        <span>
                          {label}

                          <small>
                            {translatedEvent(
                              event,
                            )}
                          </small>
                        </span>

                        <b>
                          {fmt(
                            ev(
                              event,
                            ),
                          )}
                        </b>
                      </div>

                      <div className="funnel-track">
                        <div
                          style={{
                            width: `${Math.max(
                              1,
                              (100 *
                                ev(
                                  event,
                                )) /
                                Math.max(
                                  1,
                                  ev(
                                    'view_item',
                                  ),
                                ),
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>

            <div className="note">
              <Info
                size={17}
              />

              <span>
                O botão “Solicitar
                orçamento” dispara
                o evento add_to_cart,
                mas isso não comprova
                o envio de um orçamento.

                <strong>
                  {' '}
                  A revisar:{' '}
                </strong>

                begin_checkout indica
                o início de uma etapa
                de finalização
                registrada no GA4,
                enquanto purchase
                indica uma finalização
                registrada.
                Precisamos validar
                quais ações reais da
                loja selecionada
                disparam esses eventos
                antes de considerá-los
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
              value={
                data.events.length
              }
            />

            <Card
              label="Arquivos baixados"
              value={
                ev('file_download')
              }
            />

            <Card
              label="Interações com filtros"
              value={
                ev('select_filter')
              }
            />

            <Card
              label="Zoom de produto"
              value={
                ev('view_item_zoom')
              }
            />
          </div>

          <Section
            title="Inventário de eventos"
            subtitle={`Eventos registrados na loja ${currentStore.label}. Nomes apresentados em português.`}
            right={
              <button
                className="ghost"
                onClick={() =>
                  csv(
                    `breton-${store}-eventos.csv`,
                    data.events.map(
                      (event) => ({
                        evento:
                          translatedEvent(
                            event.name,
                          ),
                        identificador_ga4:
                          event.name,
                        ocorrencias:
                          event.count,
                      }),
                    ),
                  )
                }
              >
                <Download
                  size={15}
                />
                CSV
              </button>
            }
          >
            {table(
              [
                'Evento',
                'Ocorrências',
              ],
              [
                ...data.events,
              ]
                .sort(
                  (a, b) =>
                    b.count -
                    a.count,
                )
                .map(
                  (event) => [
                    translatedEvent(
                      event.name,
                    ),
                    event.count,
                  ],
                ),
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
            value={
              data.overview.activeUsers
            }
            detail="Pessoas distintas que tiveram uma sessão engajada ou atividade reconhecida pelo GA4 no período."
          />

          <Card
            label="Sessões engajadas"
            value={
              data.overview.engagedSessions
            }
            detail="Visitas que atenderam a pelo menos um critério de engajamento do GA4."
          />

          <Card
            label="Taxa de engajamento"
            value={pct(
              data.overview
                .engagementRate,
            )}
            detail="Percentual de sessões com mais de 10 segundos, 2 ou mais páginas/telas ou um evento principal configurado no GA4."
          />

          <Card
            label="Duração média da sessão"
            value={`${(
              data.overview
                .avgSessionSeconds /
              60
            ).toFixed(1)} min`}
          />
        </div>

        <div className="two">
          <Section title="Dispositivos">
            <Bars
              items={data.devices.map(
                (device) => ({
                  name:
                    translatedDevice(
                      device.name,
                    ),
                  value:
                    device.sessions,
                }),
              )}
            />
          </Section>

          <Section title="Países">
            <Bars
              items={data.countries.map(
                (country) => ({
                  name:
                    country.name,
                  value:
                    country.sessions,
                }),
              )}
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
          'sidebar ' +
          (menu ? 'open' : '')
        }
      >
        <div className="brand">
          <div className="brand-mark">
            B
          </div>

          <div>
            <strong>
              BRETON
            </strong>

            <small>
              INTELLIGENCE
            </small>
          </div>
        </div>

        <div className="side-caption">
          PAINEL DE ANÁLISE
        </div>

        <nav>
          {nav.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={
                  item.id
                }
                className={
                  tab ===
                  item.id
                    ? 'active'
                    : ''
                }
                onClick={() => {
                  setTab(
                    item.id,
                  );
                  setQ('');
                  setMenu(
                    false,
                  );
                }}
              >
                <Icon
                  size={18}
                />

                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="source-dot" />

          <div>
            <strong>
              Google Analytics · Breton
            </strong>

            <small>
              {currentStore.domain}
            </small>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() =>
              setMenu(
                !menu,
              )
            }
            aria-label="Abrir menu"
          >
            <Menu
              size={21}
            />
          </button>

          <div className="breadcrumb">
            Análises

            <ChevronRight
              size={15}
            />

            <span>
              {current.label}
            </span>
          </div>

          <div className="topright">
            <span className="snapshot-pill">
              <span />

              {loading
                ? 'Consultando GA4'
                : data.source ===
                    'ga4-live'
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

              <h1>
                {current.label}
              </h1>

              <p>
                {currentStore.domain}
                {' · '}
                Propriedade GA4{' '}
                {
                  currentStore.property
                }
              </p>
            </div>
          </div>

          <div
            style={{
              display:
                'flex',
              flexWrap:
                'wrap',
              alignItems:
                'center',
              gap: 12,
              marginBottom: 20,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              Loja:
            </span>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 4,
                padding: 4,
                border:
                  '1px solid #e5e0df',
                borderRadius: 10,
              }}
            >
              {(
                [
                  [
                    'br',
                    'Brasil',
                  ],
                  [
                    'en',
                    'Inglês',
                  ],
                  [
                    'es',
                    'Espanhol',
                  ],
                ] as const
              ).map(
                ([
                  value,
                  label,
                ]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={
                      store ===
                      value
                    }
                    onClick={() => {
                      if (
                        store ===
                        value
                      ) {
                        return;
                      }

                      setData(
                        emptyData(
                          value,
                        ),
                      );
                      setError(
                        '',
                      );
                      setLoading(
                        true,
                      );
                      setQ(
                        '',
                      );
                      setStore(
                        value,
                      );
                    }}
                    style={{
                      border:
                        'none',
                      borderRadius: 7,
                      padding:
                        '9px 18px',
                      cursor:
                        'pointer',
                      fontWeight: 600,
                      fontSize: 13,
                      background:
                        store ===
                        value
                          ? '#7e2a43'
                          : 'transparent',
                      color:
                        store ===
                        value
                          ? '#ffffff'
                          : 'inherit',
                    }}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>

            <span
              style={{
                fontSize: 12,
                color: '#777',
              }}
            >
              {currentStore.domain}
            </span>
          </div>

          <form
            className="date-controls"
            onSubmit={(
              event,
            ) => {
              event.preventDefault();

              setQ('');

              load(
                store,
                start,
                end,
              );
            }}
          >
            <CalendarDays
              size={17}
            />

            <label>
              De

              <input
                aria-label="Data inicial"
                type="date"
                value={start}
                max={end}
                onChange={(
                  event,
                ) =>
                  setStart(
                    event.target
                      .value,
                  )
                }
              />
            </label>

            <label>
              Até

              <input
                aria-label="Data final"
                type="date"
                value={end}
                min={start}
                onChange={(
                  event,
                ) =>
                  setEnd(
                    event.target
                      .value,
                  )
                }
              />
            </label>

            <button
              disabled={
                loading
              }
              type="submit"
            >
              {loading
                ? 'Consultando...'
                : 'Aplicar período'}
            </button>
          </form>

          {!loading &&
            error && (
              <div className="note">
                <Info
                  size={17}
                />

                <span>
                  {error}
                </span>
              </div>
            )}

          {loading ? (
            <div
              role="status"
              aria-live="polite"
              style={{
                minHeight: 320,
                display:
                  'flex',
                flexDirection:
                  'column',
                alignItems:
                  'center',
                justifyContent:
                  'center',
                gap: 16,
                color:
                  '#7e2a43',
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
                Buscando dados do
                Google Analytics...
              </strong>

              <span
                style={{
                  color:
                    '#777',
                  fontSize: 13,
                }}
              >
                Consultando a loja{' '}
                {
                  currentStore.label
                }
                . Aguarde.
              </span>
            </div>
          ) : data.source ===
            'unavailable' ? (
            <Section
              title="Sem dados para este período"
              subtitle={`Não foi possível consultar a propriedade GA4 ${currentStore.property}.`}
            >
              <p>
                Verifique as credenciais
                da conta de serviço e
                a permissão de Leitor
                na propriedade
                selecionada.
              </p>
            </Section>
          ) : (
            render()
          )}

          <footer>
            Breton Intelligence
            {' · '}

            {loading
              ? 'Consultando dados...'
              : data.source ===
                  'ga4-live'
                ? `${currentStore.label} · ${start} a ${end}`
                : 'Consulta indisponível'}
          </footer>
        </div>
      </main>

      {menu && (
        <div
          className="scrim"
          onClick={() =>
            setMenu(
              false,
            )
          }
        />
      )}
    </div>
  );
}
