# @geoura/react

Integração do GEOura para sites React e Next.js. A Tironi Tech é o primeiro ambiente de validação.

## Instalação automática

```bash
npm install @geoura/react
npx geoura init
```

O assistente detecta Next.js, Vite ou React, cria o provider, integra-o ao layout/entrypoint, gera `.env.local`, protege esse arquivo no `.gitignore` e grava `geoura.config.json`. Ele não coloca chaves da OpenAI, token administrativo ou credenciais Google no frontend.

Para automação de CI ou instalação sem perguntas:

```bash
npx geoura init --yes --site-id tironi-tech --api-url https://api.geoura.com
npx geoura doctor
```

Use `--dry-run` para visualizar as alterações. O envio remoto permanece desligado por padrão; `--send` só deve ser usado depois que autenticação pública, CORS e rate limit estiverem configurados na API.

## O que o pacote faz

- lê sinais observáveis das páginas no navegador;
- executa uma avaliação local sem alegar indexação ou citação;
- envia páginas para análise no GEOura quando habilitado;
- registra conversões associadas ao conteúdo;
- solicita briefings à API;
- oferece helpers de metadata e `Article` JSON-LD para Next.js.

O pacote não altera conteúdo automaticamente. Recomendações e mudanças editoriais devem passar por aprovação.

## React / Next.js

```jsx
"use client";

import { GeouraPageObserver, GeouraProvider } from "@geoura/react";

export function Providers({ children }) {
  return (
    <GeouraProvider
      siteId="tironitech"
      publicKey={process.env.NEXT_PUBLIC_GEOURA_KEY}
    >
      {/* A leitura é local por padrão. Ative send somente após consentimento. */}
      <GeouraPageObserver send={false} />
      {children}
    </GeouraProvider>
  );
}
```

Inclua `Providers` no layout principal. Nunca coloque uma chave secreta em variável `NEXT_PUBLIC_*`; a chave pública deve apenas identificar a instalação e estar sujeita a limites por domínio na API.

## Conversão

```jsx
const trackConversion = useGeouraConversion();

await trackConversion("lead_form_sent", {
  pageUrl: window.location.href,
  leadId: "id-anonimizado"
});
```

## Briefing editorial

Chamadas que geram conteúdo devem partir do servidor ou painel autenticado:

```js
import { createGeouraAdminClient } from "@geoura/react/core";

const client = createGeouraAdminClient({
  siteId: "tironitech",
  adminToken: process.env.GEOURA_ADMIN_TOKEN,
});
const brief = await client.requestBrief({
  pageUrl: "https://www.tironitech.com/blog/artigo",
  businessGoal: "Gerar pedidos de diagnóstico",
  primaryQuery: "automação de atendimento com IA",
  firstPartyEvidence: ["Projeto implantado", "Métrica observada"],
});
```

Briefing e geração são operações de servidor. A chave da OpenAI nunca deve ser colocada no site. Depois de revisar o briefing, o painel autenticado pode solicitar um rascunho com `client.generateContent({ brief, firstPartyEvidence, sourceUrls })`. O retorno inclui afirmações sem comprovação e checklist de revisão; conteúdo não é publicado automaticamente.

O mesmo cliente editorial pode iniciar uma varredura completa com `client.crawlSite({ url, maxPages: 1000 })`. A descoberta combina sitemap e links internos do mesmo domínio; não depende de nomes de seções ou caminhos predefinidos e respeita regras `Disallow` do `robots.txt`. O limite é configurável até 5.000 páginas por execução para evitar loops e explosões de URLs parametrizadas.

## Growth Engine

```js
const run = await client.runGrowthCycle({
  url: "https://www.tironitech.com",
  propertyUrl: "sc-domain:tironitech.com",
});

const opportunity = run.opportunities.opportunities[0];
const content = await client.createContentPackage({
  opportunityId: opportunity.id,
  businessGoal: "Gerar oportunidades comerciais qualificadas",
  useWebResearch: true,
});

await client.approveContentPackage(content.id, {
  reviewer: "Editor responsável",
  notes: "Fontes e afirmações conferidas",
  confirmations: {
    factsVerified: true,
    cannibalizationReviewed: true,
    visibleContentConfirmed: true,
  },
});

const draft = await client.exportContentPackage(content.id, { platform: "react" });
```

A exportação React continua sendo um rascunho com `noindex,nofollow`. Publicação no site exige uma ação separada do editor.

## Plataformas

O adaptador React identifica React e Next.js, enquanto o `@geoura/sdk` oferece o mesmo contrato básico para HTML, Shopify, Tray, WordPress e integrações próprias. A avaliação classifica a página antes de aplicar critérios diferentes para home, landing, artigo, índice, produto e contato.

## Testes

```bash
npm test
```

## Próximo passo para produção

A API da Suite já fornece varredura, persistência histórica, Search Console, oportunidades, pesquisa, pacotes editoriais e aprovação. Antes de produção em múltiplas instâncias ainda são necessários PostgreSQL, autenticação por instalação, limites distribuídos, consentimento, fila de jobs e retenção definida.
