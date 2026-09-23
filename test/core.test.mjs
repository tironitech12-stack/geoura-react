import test from "node:test";
import assert from "node:assert/strict";
import { buildBriefInput, buildContentInput, classifyPage, createGeouraAdminClient, createGeouraClient, evaluatePage } from "../src/core.mjs";

test("avalia sinais observáveis sem prometer indexação", () => {
  const result = evaluatePage({ pageType:"article",title:"Artigo",description:"Resumo",canonical:"https://example.com/a",language:"pt-BR",h1:["Artigo"],headings:["A","B","C"],words:700,images:1,imagesWithoutAlt:0,internalLinks:4,externalLinks:2,validJsonLd:1,invalidJsonLd:0,author:"Ana",hasFaq:true,ogTitle:"Artigo",ogDescription:"Resumo",ogImage:"https://example.com/a.png" });
  assert.equal(result.score, 100);
  assert.match(result.summary, /14 de 14/);
  assert.equal(result.dimensions.geo, 100);
});

test("classifica artigo e valida entrada de geração", () => {
  assert.equal(classifyPage({ path:"/blog/a", structuredDataTypes:["BlogPosting"] }), "article");
  assert.equal(buildContentInput({ brief:{title:"A"} }).format, "article");
  assert.throws(() => buildContentInput({}), /brief/);
});

test("briefing exige página e objetivo comercial", () => {
  assert.throws(() => buildBriefInput({ pageUrl:"https://example.com" }), /businessGoal/);
  const input = buildBriefInput({ pageUrl:" https://example.com/a ",businessGoal:" Gerar leads ",knownQuestions:[" Quanto custa? "] });
  assert.equal(input.pageUrl, "https://example.com/a");
  assert.deepEqual(input.knownQuestions, ["Quanto custa?"]);
});

test("cliente envia identificação do site", async () => {
  let request;
  const client = createGeouraClient({ siteId:"tironitech", apiBase:"https://api.example", fetch:async (url,options) => { request={url,options}; return {ok:true,json:async()=>({ok:true})}; } });
  await client.notifyPublished({url:"https://www.tironitech.com/artigo"});
  assert.equal(request.url, "https://api.example/v1/pages/published");
  assert.equal(JSON.parse(request.options.body).siteId, "tironitech");
});

test("cliente editorial mantém token fora do payload", async () => {
  let request;
  const client=createGeouraAdminClient({siteId:"tironitech",adminToken:"secret",apiBase:"https://api.example",fetch:async(url,options)=>{request={url,options};return {ok:true,json:async()=>({result:{}})};}});
  await client.requestBrief({pageUrl:"https://example.com/a",businessGoal:"Gerar leads"});
  assert.equal(request.options.headers.authorization,"Bearer secret");
  assert.equal(JSON.parse(request.options.body).adminToken,undefined);
});
