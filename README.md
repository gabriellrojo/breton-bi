# Breton Intelligence — Next.js

Dashboard de BI para a propriedade GA4 **494454950** (Breton.co PT).

## Executar

```bash
npm install
cp .env.example .env.local
npm run dev
```

Sem credenciais, a aplicação mostra **apenas uma amostra histórica** de 11/08 a 08/11/2026. A amostra não contém todas as URLs e não deve ser confundida com um sitemap completo. Se você selecionar outras datas sem configurar a API, a interface não reaproveitará os dados do período anterior.

## Ativar consultas dinâmicas

1. No Google Cloud, crie um projeto (ou use um existente), habilite a **Google Analytics Data API** e crie uma **conta de serviço** com chave JSON.
2. Em **Admin > Gerenciamento de acesso à propriedade** do GA4 `494454950`, adicione o e-mail da conta de serviço com permissão **Leitor**.
3. Configure `GA4_SERVICE_ACCOUNT_JSON` no `.env.local` (JSON completo em uma única variável, preservando `\\n` na chave privada).
4. Reinicie `npm run dev`. Selecione as datas e clique em **Aplicar período**.

A rota server-side `GET /api/ga4?start=YYYY-MM-DD&end=YYYY-MM-DD` consulta o GA4, incluindo páginas, produtos, eventos, aquisição, dispositivos, países e páginas de entrada. As URLs são paginadas até 100 mil linhas. A chave da conta de serviço fica **somente no servidor**; nunca a publique no Git.

## Como ler o mapa

O mapa é gerado automaticamente de **todas as URLs que tiveram visualizações no período consultado**, incluindo áreas interna/externa, produtos e páginas institucionais. Não equivale ao sitemap técnico: páginas publicadas sem acessos no período não constam no GA4. Para uma auditoria 100% das páginas publicadas, combine o GA4 com os sitemaps do site/Deco/VTEX.

## Métricas

`add_to_cart` = **Adições para orçamento** (o botão "Solicitar orçamento" dispara esse evento na PDP). Não equivale a solicitação enviada. `purchase` ainda não foi validado como venda ou orçamento concluído. Métricas de item podem ter escopo diferente de eventos. A consulta agregada inicial de sessões (184.039) diferiu da soma diária (179.683); o modo conectado usa uma consulta agregada consistente para o período solicitado.
