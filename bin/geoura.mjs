#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { applyInstallPlan, createInstallPlan, diagnoseInstallation, detectProject } from "../src/installer.mjs";

function options(args){const result={command:args[0]||"help"};for(let i=1;i<args.length;i++){const value=args[i];if(value==="--yes"||value==="-y")result.yes=true;else if(value==="--dry-run")result.dryRun=true;else if(value==="--send")result.send=true;else if(value.startsWith("--")){const key=value.slice(2).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());result[key]=args[++i];}}return result;}
const ask=async(rl,label,fallback)=>{const answer=(await rl.question(`${label} (${fallback}): `)).trim();return answer||fallback;};

async function init(args){
  const project=await detectProject(process.cwd());let siteId=args.siteId||project.packageJson.name?.replace(/^@[^/]+\//,"")||"meu-site",apiUrl=args.apiUrl||"http://127.0.0.1:4173",send=Boolean(args.send),confirmed=Boolean(args.yes);let rl;
  if(!args.yes){rl=createInterface({input,output});siteId=await ask(rl,"Identificador do site",siteId);apiUrl=await ask(rl,"URL da API GEOura",apiUrl);send=/^s/i.test(await ask(rl,"Enviar análises do navegador agora? s/N",send?"s":"N"));}
  const plan=await createInstallPlan({root:process.cwd(),siteId,apiUrl,send});
  output.write(`\nGEOura detectou ${plan.project.framework} em ${plan.project.entry}.\n`);for(const change of plan.changes)output.write(`  ${change.action}: ${change.path} (${change.reason})\n`);for(const warning of plan.warnings)output.write(`  atenção: ${warning}\n`);
  if(args.dryRun){rl?.close();output.write("\nDry-run concluído; nenhum arquivo foi alterado.\n");return;}
  if(!confirmed){confirmed=/^s/i.test(await ask(rl,"Aplicar essas alterações? s/N","N"));}rl?.close();if(!confirmed){output.write("Instalação cancelada.\n");return;}
  const result=await applyInstallPlan(plan);output.write(`\nGEOura configurado em ${result.changed} arquivo(s).\nExecute “npx geoura doctor” para validar. O Google Search Console e as chaves privadas são configurados somente na GEOura Suite.\n`);
}

async function doctor(){const diagnosis=await diagnoseInstallation(process.cwd());for(const check of diagnosis.checks)output.write(`${check.passed?"✓":"✗"} ${check.message}\n`);if(!diagnosis.passed)process.exitCode=1;}
function help(){output.write(`GEOura CLI\n\n  npx geoura init [--site-id id] [--api-url url] [--send] [--yes] [--dry-run]\n  npx geoura doctor\n\nO instalador altera somente o projeto atual e nunca grava segredos da OpenAI ou do Google no frontend.\n`);}

const args=options(process.argv.slice(2));
try{if(args.command==="init")await init(args);else if(args.command==="doctor")await doctor();else help();}catch(error){console.error(`GEOura: ${error.message}`);process.exitCode=1;}

