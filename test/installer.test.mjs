import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyInstallPlan, createInstallPlan, diagnoseInstallation } from "../src/installer.mjs";

async function project(t,name="site") {const root=await mkdtemp(join(tmpdir(),"geoura-install-"));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(join(root,"app"),{recursive:true});await writeFile(join(root,"package.json"),JSON.stringify({name,dependencies:{next:"16.0.0",react:"19.0.0","@geoura/react":"0.4.0"}}));await writeFile(join(root,"app","layout.jsx"),'export default function Layout({ children }) { return <html><body>{children}</body></html>; }\n');return root;}

test("instalador detecta Next, cria provider e altera layout de forma idempotente",async t=>{
  const root=await project(t,"tironi-tech");
  const plan=await createInstallPlan({root,siteId:"tironi-tech",apiUrl:"https://api.example.com",publicKey:"gpk_test"});assert.equal(plan.project.framework,"next");assert.equal(plan.changes.length,5);
  await applyInstallPlan(plan);const layout=await readFile(join(root,"app","layout.jsx"),"utf8"),provider=await readFile(join(root,"app","geoura-provider.jsx"),"utf8"),env=await readFile(join(root,".env.local"),"utf8");
  assert.match(layout,/GeouraProviders/);assert.match(provider,/send=\{false\}/);assert.match(env,/NEXT_PUBLIC_GEOURA_KEY=gpk_test/);
  const second=await createInstallPlan({root,siteId:"tironi-tech",apiUrl:"https://api.example.com",publicKey:"gpk_test"});assert.equal(second.changes.length,0);
});

test("doctor valida arquivos e endpoint de saúde",async t=>{
  const root=await project(t);await applyInstallPlan(await createInstallPlan({root,siteId:"site",apiUrl:"https://api.example.com",publicKey:"gpk_test"}));
  const result=await diagnoseInstallation(root,{fetcher:async()=>({ok:true,status:200})});assert.equal(result.passed,true);assert.equal(result.checks.find(check=>check.id==="api").passed,true);
});

test("dry plan não modifica projeto e envio remoto gera alerta",async t=>{
  const root=await project(t);const before=await readFile(join(root,"app","layout.jsx"),"utf8");const plan=await createInstallPlan({root,siteId:"site",send:true,publicKey:"gpk_test"});assert.match(plan.warnings.join(" "),/autenticação pública/);assert.equal(await readFile(join(root,"app","layout.jsx"),"utf8"),before);
});

test("instalador envolve o App em projetos Vite",async t=>{
  const root=await mkdtemp(join(tmpdir(),"geoura-vite-"));t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(join(root,"src"),{recursive:true});await writeFile(join(root,"package.json"),JSON.stringify({name:"vite-site",dependencies:{react:"19.0.0","@geoura/react":"0.4.0"},devDependencies:{vite:"7.0.0"}}));await writeFile(join(root,"src","main.jsx"),'import App from "./App.jsx";\ncreateRoot(document.getElementById("root")).render(<App />);\n');
  const plan=await createInstallPlan({root,siteId:"vite-site",publicKey:"gpk_test"});await applyInstallPlan(plan);const entry=await readFile(join(root,"src","main.jsx"),"utf8"),provider=await readFile(join(root,"src","geoura-provider.jsx"),"utf8");assert.match(entry,/<GeouraProviders><App \/><\/GeouraProviders>/);assert.match(provider,/import\.meta\.env\.VITE_GEOURA_API/);
});
