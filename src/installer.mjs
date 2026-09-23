import { randomBytes } from "node:crypto";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

const exists = async path => access(path).then(() => true, () => false);
const read = async path => readFile(path, "utf8");
const ENV_START = "# GEOURA START";
const ENV_END = "# GEOURA END";

function validSiteId(value) {
  const normalized = String(value || "").trim().toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
  if (!/^[a-z0-9][a-z0-9_-]+$/.test(normalized)) throw new Error("Não foi possível criar um siteId válido.");
  return normalized;
}

function validApiUrl(value) {
  const url = new URL(String(value || "http://127.0.0.1:4173"));
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("A API GEOura deve usar HTTP ou HTTPS.");
  return url.toString().replace(/\/$/, "");
}

async function firstExisting(root, candidates) {
  for (const candidate of candidates) if (await exists(join(root, candidate))) return candidate;
  return null;
}

export async function detectProject(root = process.cwd()) {
  const projectRoot = resolve(root), packagePath = join(projectRoot, "package.json");
  if (!await exists(packagePath)) throw new Error("package.json não encontrado. Execute o comando na raiz do site.");
  const packageJson = JSON.parse(await read(packagePath));
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  const nextLayout = await firstExisting(projectRoot, ["app/layout.tsx", "app/layout.jsx", "app/layout.js", "src/app/layout.tsx", "src/app/layout.jsx", "src/app/layout.js"]);
  const reactEntry = await firstExisting(projectRoot, ["src/main.tsx", "src/main.jsx", "src/main.js", "src/index.tsx", "src/index.jsx", "src/index.js"]);
  const framework = dependencies.next || nextLayout ? "next" : dependencies.vite ? "vite" : dependencies.react ? "react" : "unknown";
  return { root: projectRoot, packageJson, packagePath, dependencies, framework, entry: framework === "next" ? nextLayout : reactEntry };
}

function providerSource({ framework, envPrefix, send }) {
  const env = name => framework === "vite" ? `import.meta.env.${envPrefix}${name}` : `process.env.${envPrefix}${name}`;
  return `"use client";\n\nimport { GeouraPageObserver, GeouraProvider } from "@geoura/react";\n\nexport function GeouraProviders({ children }) {\n  return (\n    <GeouraProvider\n      siteId={${env("SITE_ID")}}\n      publicKey={${env("KEY")}}\n      apiBase={${env("API")}}\n    >\n      <GeouraPageObserver send={${send ? `${env("SEND")} === "true"` : "false"}} />\n      {children}\n    </GeouraProvider>\n  );\n}\n`;
}

function addImport(source, importLine) {
  if (source.includes(importLine) || source.includes("GeouraProviders")) return source;
  const imports = [...source.matchAll(/^import[^;]+;?\s*$/gm)];
  if (!imports.length) return `${importLine}\n${source}`;
  const last = imports.at(-1); return `${source.slice(0, last.index + last[0].length)}\n${importLine}${source.slice(last.index + last[0].length)}`;
}

function patchNextLayout(source) {
  let next = addImport(source, 'import { GeouraProviders } from "./geoura-provider";');
  if (next.includes("<GeouraProviders>")) return next;
  const index = next.indexOf("{children}");
  if (index < 0) throw new Error("O layout Next.js não contém {children}; integração automática interrompida.");
  return `${next.slice(0,index)}<GeouraProviders>{children}</GeouraProviders>${next.slice(index+10)}`;
}

function patchReactEntry(source) {
  let next = addImport(source, 'import { GeouraProviders } from "./geoura-provider";');
  if (next.includes("<GeouraProviders>")) return next;
  const match = next.match(/<App\s*\/>/);
  if (!match) throw new Error("O entrypoint React não contém <App />; integração automática interrompida.");
  return next.replace(match[0], `<GeouraProviders>${match[0]}</GeouraProviders>`);
}

function envBlock({ prefix, siteId, apiUrl, publicKey, send }) {
  return `${ENV_START}\n${prefix}SITE_ID=${siteId}\n${prefix}API=${apiUrl}\n${prefix}KEY=${publicKey}\n${prefix}SEND=${send ? "true" : "false"}\n${ENV_END}`;
}

function mergeEnv(source, block) {
  const pattern = new RegExp(`${ENV_START}[\\s\\S]*?${ENV_END}`, "m");
  if (pattern.test(source)) return source.replace(pattern, block).replace(/\s*$/, "\n");
  return `${source.replace(/\s*$/, "")}\n\n${block}\n`.replace(/^\n+/, "");
}

export async function createInstallPlan({ root = process.cwd(), siteId, apiUrl = "http://127.0.0.1:4173", publicKey = `gpk_${randomBytes(18).toString("base64url")}`, send = false } = {}) {
  const project = await detectProject(root);
  if (project.framework === "unknown") throw new Error("Projeto React, Next.js ou Vite não identificado.");
  if (!project.entry) throw new Error(`Entrypoint do projeto ${project.framework} não encontrado.`);
  const safeSiteId = validSiteId(siteId || project.packageJson.name || "meu-site"), safeApiUrl = validApiUrl(apiUrl);
  const extension = project.entry.endsWith(".tsx") ? "tsx" : "jsx";
  const entryDirectory = dirname(project.entry), providerPath = join(project.root, entryDirectory, `geoura-provider.${extension}`);
  const prefix = project.framework === "next" ? "NEXT_PUBLIC_GEOURA_" : project.framework === "vite" ? "VITE_GEOURA_" : "REACT_APP_GEOURA_";
  const envPath = join(project.root, ".env.local"), gitignorePath = join(project.root, ".gitignore"), configPath = join(project.root, "geoura.config.json"), entryPath = join(project.root, project.entry);
  const entrySource = await read(entryPath), envSource = await exists(envPath) ? await read(envPath) : "", gitignoreSource = await exists(gitignorePath) ? await read(gitignorePath) : "";
  const changes = [
    { path: providerPath, content: providerSource({ framework:project.framework,envPrefix:prefix,send }), reason:"provider GEOura" },
    { path: entryPath, content: project.framework === "next" ? patchNextLayout(entrySource) : patchReactEntry(entrySource), reason:"integração no entrypoint" },
    { path: envPath, content:mergeEnv(envSource,envBlock({prefix,siteId:safeSiteId,apiUrl:safeApiUrl,publicKey,send})), reason:"variáveis públicas" },
    { path:gitignorePath, content:gitignoreSource.split(/\r?\n/).includes(".env.local")?gitignoreSource:`${gitignoreSource.replace(/\s*$/,"")}\n.env.local\n`.replace(/^\n/,""), reason:"proteção do ambiente local" },
    { path:configPath, content:`${JSON.stringify({version:1,siteId:safeSiteId,framework:project.framework,apiUrl:safeApiUrl,provider:relative(project.root,providerPath).replaceAll("\\","/"),entry:project.entry,send},null,2)}\n`, reason:"configuração GEOura" }
  ];
  const effective=[];
  for(const change of changes){const current=await exists(change.path)?await read(change.path):null;if(current!==change.content)effective.push({...change,action:current===null?"create":"update"});}
  const warnings=[];
  if(!project.dependencies["@geoura/react"])warnings.push("@geoura/react não aparece nas dependências; execute npm install @geoura/react.");
  if(send)warnings.push("O envio remoto foi solicitado. Confirme autenticação pública, CORS e rate limit antes da produção.");
  return {project:{framework:project.framework,entry:project.entry,root:project.root},configuration:{siteId:safeSiteId,apiUrl:safeApiUrl,publicKey,send},changes:effective,warnings};
}

async function atomicWrite(path, content) {
  await mkdir(dirname(path),{recursive:true});const temporary=`${path}.${process.pid}.${Date.now()}.tmp`;await writeFile(temporary,content,"utf8");await rename(temporary,path);
}

export async function applyInstallPlan(plan) {
  for (const change of plan.changes) await atomicWrite(change.path, change.content);
  return { changed: plan.changes.length, files: plan.changes.map(change => change.path) };
}

export async function diagnoseInstallation(root = process.cwd(), { fetcher = globalThis.fetch } = {}) {
  const project = await detectProject(root), configPath = join(project.root,"geoura.config.json");
  const checks=[];
  if(!await exists(configPath))return {passed:false,project,checks:[{id:"config",passed:false,message:"geoura.config.json não encontrado; execute npx geoura init."}]};
  const config=JSON.parse(await read(configPath));
  checks.push({id:"dependency",passed:Boolean(project.dependencies["@geoura/react"]),message:"Dependência @geoura/react"});
  checks.push({id:"provider",passed:await exists(join(project.root,config.provider||"")),message:"Provider GEOura"});
  checks.push({id:"entry",passed:Boolean(project.entry&&(await read(join(project.root,project.entry))).includes("GeouraProviders")),message:"Integração no entrypoint"});
  checks.push({id:"environment",passed:await exists(join(project.root,".env.local")),message:"Arquivo .env.local"});
  if(fetcher&&config.apiUrl){try{const response=await fetcher(`${config.apiUrl.replace(/\/$/,"")}/health`,{signal:AbortSignal.timeout(5000)});checks.push({id:"api",passed:response.ok,message:response.ok?"API GEOura acessível":`API respondeu ${response.status}`});}catch(error){checks.push({id:"api",passed:false,message:`API inacessível: ${error.message}`});}}
  return {passed:checks.every(check=>check.passed),project,config,checks};
}
