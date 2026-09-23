export type PageType = "home"|"landing"|"article"|"content-index"|"product"|"contact"|"page";
export type PageSignals = {
  url:string; path:string; platform:string; pageType:PageType; language:string; title:string; description:string;
  canonical:string; robots:string; ogTitle:string; ogDescription:string; ogImage:string; h1:string[]; headings:string[];
  words:number; images:number; imagesWithoutAlt:number; internalLinks:number; externalLinks:number; jsonLd:number;
  validJsonLd:number; invalidJsonLd:number; structuredDataTypes:string[]; questions:number; hasMain:boolean; hasFaq:boolean;
  author:string; publishedAt:string; modifiedAt:string; measuredAt:string;
};
export type Evaluation = {
  score:number; pageType:PageType; summary:string; disclaimer:string; dimensions:Record<string,number>;
  checks:Array<{id:string;passed:boolean;label:string;recommendation:string;category:string}>;
  priorities:Array<{id:string;category:string;recommendation:string}>;
};
export function detectPlatform(doc?:Document):string;
export function classifyPage(signals:Partial<PageSignals>):PageType;
export function collectPageSignals(doc?:Document):PageSignals;
export function evaluatePage(signals:Partial<PageSignals>):Evaluation;
export function buildBriefInput(input:Record<string,unknown>):Record<string,unknown>;
export function buildContentInput(input:Record<string,unknown>):Record<string,unknown>;
export function createGeouraClient(options:{siteId:string;publicKey?:string;apiBase?:string;fetch?:typeof fetch}):{
  analyze(signals:PageSignals):Promise<unknown>; notifyPublished(input:{url:string;changedAt?:string}):Promise<unknown>;
  trackConversion(input:{name:string;pageUrl:string;value?:number;leadId?:string}):Promise<unknown>;
};
export function createGeouraAdminClient(options:{siteId:string;adminToken:string;apiBase?:string;fetch?:typeof fetch}):{
  crawlSite(input:{url:string;maxPages?:number;concurrency?:number}):Promise<unknown>;
  syncSearchConsole(input:{propertyUrl:string;startDate?:string;endDate?:string;days?:number;dataState?:"all"|"final"}):Promise<unknown>;
  calculateOpportunities(input?:{minimumImpressions?:number}):Promise<unknown>;
  runGrowthCycle(input:{url:string;propertyUrl?:string;maxPages?:number;concurrency?:number;days?:number}):Promise<unknown>;
  getGrowthStatus():Promise<unknown>;
  requestBrief(input:Record<string,unknown>):Promise<unknown>;generateContent(input:Record<string,unknown>):Promise<unknown>;
  createContentPackage(input:{opportunityId:string;businessGoal?:string;useWebResearch?:boolean;language?:string;siteName?:string}):Promise<unknown>;
  approveContentPackage(id:string,input:{reviewer:string;notes?:string;confirmations:{factsVerified:boolean;cannibalizationReviewed:boolean;visibleContentConfirmed:boolean}}):Promise<unknown>;
  rejectContentPackage(id:string,input:{reviewer?:string;notes?:string}):Promise<unknown>;
  exportContentPackage(id:string,input?:{platform?:"react"}):Promise<unknown>;
};
export function GeouraProvider(props:{children:unknown;siteId:string;publicKey?:string;apiBase?:string;enabled?:boolean}):unknown;
export function GeouraPageObserver(props:{send?:boolean;onResult?:(result:unknown)=>void}):null;
export function useGeoura():{client:ReturnType<typeof createGeouraClient>|null;enabled:boolean;siteId:string};
export function useGeouraAudit():{result:unknown;run:()=>unknown};
export function useGeouraConversion():(name:string,details?:Record<string,unknown>)=>Promise<unknown>;
