import React, { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { collectPageSignals, createGeouraClient, evaluatePage } from "./core.mjs";

const GeouraContext = createContext(null);
const NAVIGATION_EVENT = "geoura:navigation";
let historyPatched = false;

function installNavigationBridge() {
  if (historyPatched || typeof window === "undefined") return;
  historyPatched = true;
  for (const method of ["pushState", "replaceState"]) {
    const original = window.history?.[method];
    if (typeof original !== "function") continue;
    window.history[method] = function(...args) {
      const result = original.apply(this, args);
      window.dispatchEvent(new Event(NAVIGATION_EVENT));
      return result;
    };
  }
}

function scheduleWhenIdle(callback) {
  let cancelled = false, handle;
  const run = () => {
    if (cancelled) return;
    if (typeof globalThis.requestIdleCallback === "function") handle = globalThis.requestIdleCallback(() => !cancelled && callback(), { timeout:1500 });
    else handle = globalThis.setTimeout(() => !cancelled && callback(), 0);
  };
  if (typeof globalThis.requestAnimationFrame === "function") handle = globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(run));
  else run();
  return () => { cancelled = true; if (typeof globalThis.cancelIdleCallback === "function") globalThis.cancelIdleCallback(handle); globalThis.clearTimeout?.(handle); globalThis.cancelAnimationFrame?.(handle); };
}

export function GeouraProvider({ children, siteId, publicKey = "", apiBase = "https://api.geoura.com", enabled = true }) {
  const configured = Boolean(String(siteId || "").trim());
  const active = Boolean(enabled && configured);
  const client = useMemo(() => active ? createGeouraClient({ siteId, publicKey, apiBase }) : null, [siteId, publicKey, apiBase, active]);
  const value = useMemo(() => ({ client, enabled:active, configured, siteId:siteId || "" }), [client, active, configured, siteId]);
  return createElement(GeouraContext.Provider, { value }, children);
}

export function GeouraPageObserver({ send = false, onResult }) {
  const context = useGeoura();
  useEffect(() => {
    if (!context.enabled || typeof document === "undefined") return;
    installNavigationBridge();
    let cancelScheduled = () => {}, lastMeasurement = "";
    const measure = () => {
      cancelScheduled();
      cancelScheduled = scheduleWhenIdle(async () => {
        try {
          const signals = collectPageSignals(document), measurement = `${signals.url}|${signals.title}|${signals.words}`;
          if (measurement === lastMeasurement) return;
          lastMeasurement = measurement;
          const local = evaluatePage(signals);
          onResult?.({ signals, local });
          if (send && context.client) {
            try { const remote = await context.client.analyze(signals); onResult?.({ signals, local, remote }); }
            catch (error) { onResult?.({ signals, local, error }); }
          }
        } catch (error) { onResult?.({ error }); }
      });
    };
    const events = ["popstate", "hashchange", NAVIGATION_EVENT];
    events.forEach(event => globalThis.addEventListener?.(event, measure));
    globalThis.navigation?.addEventListener?.("navigatesuccess", measure);
    measure();
    return () => { cancelScheduled(); events.forEach(event => globalThis.removeEventListener?.(event, measure)); globalThis.navigation?.removeEventListener?.("navigatesuccess", measure); };
  }, [context, send, onResult]);
  return null;
}

export function useGeoura() {
  const value = useContext(GeouraContext);
  if (!value) throw new Error("useGeoura deve ser usado dentro de GeouraProvider.");
  return value;
}

export function useGeouraAudit() {
  const [result, setResult] = useState(null);
  const run = useCallback(() => {
    const signals = collectPageSignals(document);
    const next = { signals, evaluation: evaluatePage(signals) };
    setResult(next);
    return next;
  }, []);
  return { result, run };
}

export function useGeouraConversion() {
  const { client, enabled, configured } = useGeoura();
  return useCallback(async (name, details = {}) => {
    if (!enabled || !client) return { skipped: true, reason:configured ? "disabled" : "not-configured" };
    return client.trackConversion({ name, pageUrl: details.pageUrl || globalThis.location?.href || "", value: details.value, leadId: details.leadId });
  }, [client, enabled, configured]);
}

export { buildBriefInput, buildContentInput, classifyPage, collectPageSignals, createGeouraAdminClient, createGeouraClient, detectPlatform, evaluatePage } from "./core.mjs";
