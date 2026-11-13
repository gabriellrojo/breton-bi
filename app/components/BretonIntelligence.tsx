"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Lightbulb, Search, Sparkles } from "lucide-react";

type Product = { itemId?: string; name: string; views: number; quoteAdds: number };
type Metrics = { sessions: number; activeUsers: number; pageViews: number; quoteAdds: number };
type Period = { from: string; to: string };
type Input = {
  storeLabel: string;
  period?: Period;
  previousPeriod?: Period;
  comparison?: { current: Metrics; previous: Metrics };
  products: Product[];
};
type Insight = { id: string; category: "Tráfego" | "Orçamentos" | "Produtos"; title: string; body: string; priority: number };
const fmt = (n: number) => new Intl.NumberFormat("pt-BR").format(n);
const percent = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const date = (s: string) => s.split("-").reverse().join("/");
function change(current: number, previous: number): number | null {
  return previous > 0 ? ((current - previous) / previous) * 100 : null;
}
function compareText(value: number | null): string {
  if (value === null) return "sem base anterior suficiente";
  return `${value > 0 ? "+" : ""}${percent(value)} frente ao período anterior`;
}

export default function BretonIntelligence({ storeLabel, period, previousPeriod, comparison, products }: Input) {
  const [filter, setFilter] = useState<"Todos" | Insight["category"]>("Todos");
  const [query, setQuery] = useState("");
  const analysis = useMemo(() => {
    const insights: Insight[] = [];
    if (comparison) {
      const { current, previous } = comparison;
      const sessions = change(current.sessions, previous.sessions);
      const views = change(current.pageViews, previous.pageViews);
      const quotes = change(current.quoteAdds, previous.quoteAdds);
      if (sessions !== null && Math.abs(sessions) >= 10) {
        insights.push({ id: "sessions", category: "Tráfego", priority: Math.abs(sessions), title: sessions < 0 ? "Queda relevante de sessões" : "Crescimento relevante de sessões", body: `As sessões passaram de ${fmt(previous.sessions)} para ${fmt(current.sessions)} (${compareText(sessions)}). Investigue canais e páginas de entrada para entender a mudança.` });
      }
      if (views !== null && Math.abs(views) >= 10) {
        insights.push({ id: "views", category: "Tráfego", priority: Math.abs(views), title: views < 0 ? "Redução de visualizações" : "Aumento de visualizações", body: `As visualizações de páginas passaram de ${fmt(previous.pageViews)} para ${fmt(current.pageViews)} (${compareText(views)}). A variação isolada não determina melhora ou piora.` });
      }
      if (quotes !== null && Math.abs(quotes) >= 10) {
        insights.push({ id: "quotes", category: "Orçamentos", priority: Math.abs(quotes), title: quotes < 0 ? "Menos adições à lista de orçamento" : "Mais adições à lista de orçamento", body: `O evento add_to_cart passou de ${fmt(previous.quoteAdds)} para ${fmt(current.quoteAdds)} (${compareText(quotes)}). Trata-se de adições, não de orçamentos concluídos.` });
      }
      if (previous.sessions > 0 && current.sessions > 0 && previous.quoteAdds >= 10 && current.quoteAdds >= 10) {
        const currentRate = (current.quoteAdds / current.sessions) * 100;
        const previousRate = (previous.quoteAdds / previous.sessions) * 100;
        if (Math.abs(currentRate - previousRate) >= 0.25) {
          insights.push({ id: "ratio", category: "Orçamentos", priority: Math.abs(currentRate - previousRate) * 15, title: "Mudança na relação entre adições e sessões", body: `Foram ${currentRate.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} adições por 100 sessões, contra ${previousRate.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} no período anterior. Esta é uma razão de eventos, não uma taxa de conversão de usuários.` });
        }
      }
    }
    const valid = products.filter(p => Number.isFinite(p.views) && Number.isFinite(p.quoteAdds) && p.views >= 30 && p.quoteAdds >= 0);
    const withViews = valid.filter(p => p.views >= 100);
    const ratios = withViews.map(p => p.quoteAdds / p.views).sort((a, b) => a - b);
    const median = ratios.length ? ratios[Math.floor(ratios.length / 2)] : null;
    const opportunities = withViews.filter(p => median !== null && median > 0 && p.quoteAdds / p.views < median * 0.4).sort((a, b) => b.views - a.views).slice(0, 8);
    if (opportunities.length) {
      insights.push({ id: "products", category: "Produtos", priority: 35, title: `${opportunities.length} produtos merecem investigação`, body: `Produtos com pelo menos 100 visualizações e relação de adições/visualizações inferior a 40% da mediana dos produtos com volume comparável. Isso não comprova problema na página nem mede conversão de usuários.` });
    }
    const unusual = products.filter(p => p.views === 0 && p.quoteAdds > 0).sort((a, b) => b.quoteAdds - a.quoteAdds).slice(0, 5);
    if (unusual.length) {
      insights.push({ id: "tracking", category: "Produtos", priority: 45, title: "Eventos de produto sem visualizações registradas", body: `${unusual.length} produtos têm adições à lista de orçamento, mas nenhuma visualização de item no relatório. Isso pode ocorrer por interações em listas ou diferenças de instrumentação; vale conferir o rastreamento.` });
    }
    return { insights: insights.sort((a, b) => b.priority - a.priority), opportunities, unusual, median };
  }, [comparison, products]);
  const visible = analysis.insights.filter(i => (filter === "Todos" || i.category === filter) && `${i.title} ${i.body}`.toLowerCase().includes(query.toLowerCase()));
  const box: React.CSSProperties = { background: "#fff", border: "1px solid #e9e3e5", borderRadius: 14, padding: 22 };
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={{ ...box, background: "#faf7f8" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", color: "#7e2a43" }}><Sparkles size={22} /><strong style={{ fontSize: 19 }}>Breton Intelligence</strong></div>
        <p style={{ color: "#665d61", lineHeight: 1.7, marginBottom: 0 }}>Análises automáticas da loja {storeLabel}, calculadas a partir dos dados reais do GA4. Sem API de IA, sem custo por análise e sem respostas inventadas.</p>
        {period && <p style={{ fontSize: 12, color: "#756d70", marginBottom: 0 }}>Período: {date(period.from)} a {date(period.to)}{previousPeriod ? ` · Comparação: ${date(previousPeriod.from)} a ${date(previousPeriod.to)}` : ""}</p>}
      </section>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
        <div style={box}><div style={{ fontSize: 12, color: "#756d70" }}>Insights identificados</div><strong style={{ fontSize: 30, color: "#7e2a43" }}>{analysis.insights.length}</strong></div>
        <div style={box}><div style={{ fontSize: 12, color: "#756d70" }}>Produtos para investigar</div><strong style={{ fontSize: 30 }}>{analysis.opportunities.length}</strong></div>
        <div style={box}><div style={{ fontSize: 12, color: "#756d70" }}>Possíveis inconsistências de eventos</div><strong style={{ fontSize: 30 }}>{analysis.unusual.length}</strong></div>
      </div>
      <section style={box}>
        <h2 style={{ fontSize: 18, marginTop: 0, color: "#332b2f" }}>Resumo do desempenho</h2>
        {comparison ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
          {([ ["Sessões", "sessions"], ["Visualizações", "pageViews"], ["Adições ao orçamento", "quoteAdds"] ] as const).map(([label, key]) => { const v = change(comparison.current[key], comparison.previous[key]); return <div key={key} style={{ background: "#faf8f8", borderRadius: 10, padding: 15 }}><div style={{ color: "#756d70", fontSize: 12 }}>{label}</div><strong style={{ display: "block", fontSize: 23, margin: "8px 0" }}>{fmt(comparison.current[key])}</strong><span style={{ fontSize: 12, color: "#655b60", display: "flex", alignItems: "center", gap: 4 }}>{v !== null && v >= 0 ? <ArrowUpRight size={14} /> : v !== null ? <ArrowDownRight size={14} /> : null}{compareText(v)}</span></div>; })}
        </div> : <p style={{ color: "#756d70" }}>Não há comparação disponível neste período.</p>}
      </section>
      <section style={box}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>Insights e alertas</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {(["Todos", "Tráfego", "Orçamentos", "Produtos"] as const).map(v => <button type="button" key={v} onClick={() => setFilter(v)} style={{ cursor: "pointer", border: "1px solid #e5d7dc", background: filter === v ? "#7e2a43" : "white", color: filter === v ? "white" : "#7e2a43", borderRadius: 20, padding: "8px 13px" }}>{v}</button>)}
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", border: "1px solid #e5d7dc", padding: "9px 12px", borderRadius: 9, marginBottom: 16 }}><Search size={16} color="#7e2a43" /><input aria-label="Buscar insights" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar insights..." style={{ border: 0, outline: 0, flex: 1, minWidth: 0 }} /></label>
        <div style={{ display: "grid", gap: 12 }}>
          {visible.length ? visible.map(i => <article key={i.id} style={{ background: "#faf8f8", borderRadius: 10, padding: 17 }}><div style={{ display: "flex", alignItems: "center", gap: 8, color: "#7e2a43" }}>{i.id === "tracking" ? <AlertTriangle size={17} /> : <Lightbulb size={17} />}<strong>{i.title}</strong></div><div style={{ fontSize: 11, color: "#88767d", marginTop: 5 }}>{i.category}</div><p style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 0, color: "#51484c" }}>{i.body}</p></article>) : <p style={{ color: "#756d70" }}>Nenhum insight corresponde aos filtros. Isso não significa ausência de oportunidades; as regras exigem volumes mínimos e variações relevantes.</p>}
        </div>
      </section>
      {analysis.opportunities.length > 0 && <section style={box}><h2 style={{ fontSize: 18, marginTop: 0 }}>Produtos para investigar</h2><p style={{ color: "#756d70", fontSize: 13, lineHeight: 1.6 }}>Critério exploratório: ao menos 100 visualizações e relação adições/visualizações abaixo de 40% da mediana do grupo. Não é uma taxa de conversão.</p><div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}><thead><tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}><th style={{ padding: 10 }}>Produto</th><th style={{ padding: 10 }}>Visualizações</th><th style={{ padding: 10 }}>Adições</th></tr></thead><tbody>{analysis.opportunities.map((p, i) => <tr key={`${p.itemId || p.name}-${i}`} style={{ borderBottom: "1px solid #f1eded" }}><td style={{ padding: 10 }}>{p.name}</td><td style={{ padding: 10 }}>{fmt(p.views)}</td><td style={{ padding: 10 }}>{fmt(p.quoteAdds)}</td></tr>)}</tbody></table></div></section>}
      <p style={{ fontSize: 12, color: "#80767b", lineHeight: 1.7 }}>Metodologia: regras determinísticas aplicadas aos dados retornados pela API existente. Os limites de 10% e 100 visualizações são parâmetros iniciais, ajustáveis após validação. Eventos de orçamento podem ocorrer fora da página de produto; portanto, não interpretamos adições/visualizações como conversão.</p>
    </div>
  );
}
