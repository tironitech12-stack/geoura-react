import { createGeouraAdminClient } from "@geoura/react/core";

// Este módulo deve ser importado somente por uma rota de servidor autenticada.
const geoura = createGeouraAdminClient({
  siteId: "tironitech",
  apiBase: process.env.GEOURA_API_URL || "http://127.0.0.1:4173",
  adminToken: process.env.GEOURA_ADMIN_TOKEN,
});

export async function prepareArticle({ pageUrl, primaryQuery, businessGoal, audience, evidence, sources }) {
  const briefResponse = await geoura.requestBrief({
    pageUrl,
    primaryQuery,
    businessGoal,
    audience,
    pageType: "article",
    firstPartyEvidence: evidence,
    sourceUrls: sources,
    conversion: "Agendamento de diagnóstico",
  });

  const draftResponse = await geoura.generateContent({
    brief: briefResponse.result,
    firstPartyEvidence: evidence,
    sourceUrls: sources,
    instructions: "Conectar o tema a uma decisão empresarial real e preservar revisão humana antes da publicação.",
  });

  return { brief: briefResponse.result, draft: draftResponse.result };
}
