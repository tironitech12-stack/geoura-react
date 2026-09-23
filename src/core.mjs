const normalize = value => String(value || "").replace(/\s+/g, " ").trim();
const clamp = value => Math.max(0, Math.min(100, Math.round(value)));
const meta = (doc, selector) => normalize(doc.querySelector(selector)?.content);

function structuredData(doc) {
  const types = new Set(); let valid = 0; let invalid = 0;
  const visit = value => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) return value.forEach(visit);
    const type = value["@type"];
    (Array.isArray(type) ? type : [type]).filter(Boolean).forEach(item => types.add(normalize(item)));
    if (value["@graph"]) visit(value["@graph"]);
  };
  for (const node of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try { visit(JSON.parse(node.textContent || "null")); valid += 1; }
    catch { invalid += 1; }
  }
  return { count:valid + invalid, valid, invalid, types:[...types].sort() };
}

export function detectPlatform(doc = globalThis.document) {
  const generator = meta(doc, 'meta[name="generator"]').toLowerCase();
  if (globalThis.Shopify || doc.querySelector('[id^="shopify-section"], script[src*="cdn.shopify.com"], link[href*="cdn.shopify.com"]')) return "shopify";
  if (doc.querySelector('script[src*="tray.com.br"], script[src*="tray-cdn"], link[href*="tray-cdn"]')) return "tray";
  if (/wordpress/i.test(generator) || doc.querySelector('link[href*="wp-content"], script[src*="wp-content"], link[rel="https://api.w.org/"]')) return "wordpress";
  if (doc.querySelector('#__next, script[src*="/_next/"]')) return "nextjs";
  if (doc.querySelector('#root, [data-reactroot]') || /react/i.test(generator)) return "react";
  return "web";
}

export function classifyPage(signals = {}) {
  const types = new Set(signals.structuredDataTypes || []);
  const path = String(signals.path || "/").replace(/\/$/, "") || "/";
  if (types.has("Product")) return "product";
  if (types.has("Article") || types.has("BlogPosting") || signals.publishedAt) return "article";
  if (path === "/") return "home";
  if (/\/(blog|artigos|insights)$/.test(path)) return "content-index";
  if (/contato|contact/.test(path)) return "contact";
  if (/servic|solu|produto|product/.test(path)) return "landing";
  return "page";
}

export function collectPageSignals(doc = globalThis.document) {
  if (!doc?.querySelectorAll) throw new Error("Um documento HTML válido é obrigatório.");
  const text = normalize(doc.body?.innerText || doc.body?.textContent);
  const images = [...doc.querySelectorAll("img")];
  const links = [...doc.querySelectorAll("a[href]")];
  const sameOrigin = link => { try { return new URL(link.href, doc.location?.href).origin === doc.location?.origin; } catch { return false; } };
  const external = link => { try { const url = new URL(link.href, doc.location?.href); return /^https?:$/.test(url.protocol) && url.origin !== doc.location?.origin; } catch { return false; } };
  const schema = structuredData(doc);
  const signals = {
    url:doc.location?.href || "", path:doc.location?.pathname || "", platform:detectPlatform(doc),
    language:doc.documentElement?.lang || "", title:normalize(doc.title),
    description:meta(doc, 'meta[name="description"]'), canonical:normalize(doc.querySelector('link[rel="canonical"]')?.href),
    robots:meta(doc, 'meta[name="robots"]'), ogTitle:meta(doc, 'meta[property="og:title"]'),
    ogDescription:meta(doc, 'meta[property="og:description"]'), ogImage:meta(doc, 'meta[property="og:image"]'),
    h1:[...doc.querySelectorAll("h1")].map(node => normalize(node.textContent)).filter(Boolean),
    headings:[...doc.querySelectorAll("h2,h3")].map(node => normalize(node.textContent)).filter(Boolean),
    words:text ? text.split(/\s+/).length : 0, images:images.length,
    imagesWithoutAlt:images.filter(image => !normalize(image.getAttribute("alt"))).length,
    internalLinks:links.filter(sameOrigin).length, externalLinks:links.filter(external).length,
    jsonLd:schema.count, validJsonLd:schema.valid, invalidJsonLd:schema.invalid, structuredDataTypes:schema.types,
    questions:[...doc.querySelectorAll("h2,h3,h4")].filter(node => /\?$/.test(normalize(node.textContent))).length,
    hasMain:Boolean(doc.querySelector("main")), hasFaq:schema.types.includes("FAQPage") || Boolean(doc.querySelector('[itemtype*="FAQPage"], [data-faq]')),
    author:normalize(doc.querySelector('[rel="author"], [itemprop="author"], .author, [data-author]')?.textContent),
    publishedAt:meta(doc, 'meta[property="article:published_time"]') || normalize(doc.querySelector("time[datetime]")?.dateTime),
    modifiedAt:meta(doc, 'meta[property="article:modified_time"]'), measuredAt:new Date().toISOString(),
  };
  return { ...signals, pageType:classifyPage(signals) };
}

export function evaluatePage(signals = {}) {
  const isArticle = signals.pageType === "article";
  const isIndex = signals.pageType === "content-index";
  const desiredWords = isArticle ? 700 : isIndex ? 100 : 250;
  const checks = [
    check("title", Boolean(signals.title), "Título identificável", "Defina um título específico para a intenção principal.", "seo"),
    check("description", Boolean(signals.description), "Descrição presente", "Escreva uma descrição específica para benefício e público.", "seo"),
    check("canonical", Boolean(signals.canonical), "URL canônica declarada", "Declare uma URL canônica absoluta.", "technical"),
    check("language", Boolean(signals.language), "Idioma declarado", "Declare o idioma no elemento html.", "technical"),
    check("h1", signals.h1?.length === 1, "Um título principal", `A página possui ${signals.h1?.length || 0} elementos H1.`, "seo"),
    check("depth", signals.words >= desiredWords, "Profundidade adequada", `A página ${signals.pageType || "page"} possui ${signals.words || 0} palavras; revise a cobertura da intenção.`, "content"),
    check("structure", isIndex || signals.headings?.length >= 2, "Estrutura escaneável", "Organize a resposta em seções descritivas.", "aeo"),
    check("images", !signals.images || signals.imagesWithoutAlt === 0, "Imagens descritas", `${signals.imagesWithoutAlt || 0} imagem(ns) precisam de texto alternativo.`, "technical"),
    check("links", signals.internalLinks >= (isArticle ? 3 : 2), "Conexões internas", "Adicione links contextuais para páginas relacionadas.", "seo"),
    check("schema", signals.validJsonLd > 0 && !signals.invalidJsonLd, "Dados estruturados válidos", signals.invalidJsonLd ? "Corrija blocos JSON-LD inválidos." : "Adicione dados estruturados coerentes com o conteúdo visível.", "geo"),
    check("responsibility", !isArticle || Boolean(signals.author), "Responsabilidade editorial", "Identifique autor, organização responsável e processo de revisão.", "geo"),
    check("evidence", !isArticle || signals.externalLinks >= 2, "Evidências externas", "Sustente afirmações relevantes com fontes primárias e verificáveis.", "geo"),
    check("answers", !isArticle || signals.hasFaq || signals.questions >= 2, "Respostas diretas", "Inclua respostas concisas para perguntas reais quando forem úteis.", "aeo"),
    check("social", Boolean(signals.ogTitle && signals.ogDescription && signals.ogImage), "Compartilhamento social", "Complete título, descrição e imagem Open Graph.", "seo"),
  ];
  const weights = { technical:.2, seo:.3, content:.15, geo:.2, aeo:.15 };
  const dimensions = Object.fromEntries(Object.keys(weights).map(category => {
    const selected = checks.filter(item => item.category === category);
    return [category, selected.length ? clamp(selected.filter(item => item.passed).length / selected.length * 100) : 100];
  }));
  const score = clamp(Object.entries(weights).reduce((sum, [key, weight]) => sum + dimensions[key] * weight, 0));
  return { score, dimensions, pageType:signals.pageType || classifyPage(signals), checks,
    priorities:checks.filter(item => !item.passed).map(({id,category,recommendation}) => ({id,category,recommendation})),
    summary:`${checks.filter(item => item.passed).length} de ${checks.length} sinais contextuais atendidos.`,
    disclaimer:"Indicador experimental baseado em sinais observáveis; não comprova indexação, posição ou citação." };
}

function check(id, passed, label, recommendation, category) { return { id, passed:Boolean(passed), label, recommendation:passed ? "" : recommendation, category }; }
function cleanList(value) { return Array.isArray(value) ? value.map(normalize).filter(Boolean).slice(0, 30) : []; }

export function buildBriefInput(input = {}) {
  const pageUrl = normalize(input.pageUrl); const businessGoal = normalize(input.businessGoal);
  if (!pageUrl) throw new Error("pageUrl é obrigatório.");
  if (!businessGoal) throw new Error("businessGoal é obrigatório.");
  return { pageUrl, businessGoal, primaryQuery:normalize(input.primaryQuery), service:normalize(input.service),
    audience:normalize(input.audience), pageType:normalize(input.pageType), knownQuestions:cleanList(input.knownQuestions),
    firstPartyEvidence:cleanList(input.firstPartyEvidence), sourceUrls:cleanList(input.sourceUrls),
    conversion:normalize(input.conversion), signals:input.signals && typeof input.signals === "object" ? input.signals : undefined };
}

export function buildContentInput(input = {}) {
  if (!input.brief || typeof input.brief !== "object") throw new Error("brief é obrigatório.");
  return { brief:input.brief, format:normalize(input.format) || "article", tone:normalize(input.tone) || "claro, confiável e direto",
    firstPartyEvidence:cleanList(input.firstPartyEvidence), sourceUrls:cleanList(input.sourceUrls), instructions:normalize(input.instructions) };
}

export function createGeouraClient(options = {}) {
  const apiBase = String(options.apiBase || "https://api.geoura.com").replace(/\/$/, "");
  const siteId = normalize(options.siteId); const publicKey = normalize(options.publicKey); const fetcher = options.fetch || globalThis.fetch;
  if (!siteId) throw new Error("siteId é obrigatório.");
  if (typeof fetcher !== "function") throw new Error("fetch não está disponível.");
  async function request(path, payload) {
    const response = await fetcher(`${apiBase}${path}`, { method:"POST", headers:{"content-type":"application/json", ...(publicKey ? {"x-geoura-key":publicKey} : {})}, body:JSON.stringify({siteId,...payload}), keepalive:true });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `GEOura API respondeu ${response.status}.`);
    return data;
  }
  return { analyze:signals => request("/v1/pages/analyze", {signals}),
    notifyPublished:({url,changedAt=new Date().toISOString()}) => request("/v1/pages/published", {url,changedAt}),
    trackConversion:({name,pageUrl,value,leadId}) => request("/v1/events", {type:"conversion",name,pageUrl,value,leadId}) };
}

export function createGeouraAdminClient(options = {}) {
  const apiBase=String(options.apiBase||"https://api.geoura.com").replace(/\/$/,"");
  const siteId=normalize(options.siteId),adminToken=normalize(options.adminToken),fetcher=options.fetch||globalThis.fetch;
  if(!siteId)throw new Error("siteId é obrigatório.");if(!adminToken)throw new Error("adminToken é obrigatório.");
  async function request(path,payload){const response=await fetcher(`${apiBase}${path}`,{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${adminToken}`},body:JSON.stringify({siteId,...payload})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||`GEOura API respondeu ${response.status}.`);return data;}
  async function get(path){const response=await fetcher(`${apiBase}${path}${path.includes("?")?"&":"?"}siteId=${encodeURIComponent(siteId)}`,{headers:{authorization:`Bearer ${adminToken}`}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||`GEOura API respondeu ${response.status}.`);return data;}
  return {
    registerInstallation:origin=>request("/v1/installations/register",{origin}),
    crawlSite:input=>request("/v1/sites/crawl",input),
    syncSearchConsole:input=>request("/v1/growth/search-console/sync",input),
    syncAnalytics:input=>request("/v1/growth/analytics/sync",input),
    syncCrux:input=>request("/v1/growth/crux/sync",input),
    calculateOpportunities:input=>request("/v1/growth/opportunities",input||{}),
    runGrowthCycle:input=>request("/v1/growth/run",input),
    enqueueGrowthCycle:input=>request("/v1/growth/jobs",input),
    getJob:id=>get(`/v1/growth/jobs/${encodeURIComponent(id)}`),
    getGrowthStatus:()=>get("/v1/growth/status"),
    createExperiment:input=>request("/v1/experiments",input),
    evaluateExperiment:id=>request(`/v1/experiments/${encodeURIComponent(id)}/evaluate`,{}),
    ingestCitationObservations:input=>request("/v1/visibility/citations/ingest",input),
    getCitationRuns:()=>get("/v1/visibility/citations"),
    requestBrief:input=>request("/v1/content/briefs",buildBriefInput(input)),
    generateContent:input=>request("/v1/content/generate",buildContentInput(input)),
    createContentPackage:input=>request("/v1/content/packages",input),
    approveContentPackage:(id,input)=>request(`/v1/content/packages/${encodeURIComponent(id)}/approve`,input),
    rejectContentPackage:(id,input)=>request(`/v1/content/packages/${encodeURIComponent(id)}/reject`,input),
    rollbackContentPackage:(id,input)=>request(`/v1/content/packages/${encodeURIComponent(id)}/rollback`,input),
    exportContentPackage:(id,input={})=>request(`/v1/content/packages/${encodeURIComponent(id)}/export`,input)
  };
}
