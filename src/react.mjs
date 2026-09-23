import React, { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { collectPageSignals, createGeouraClient, evaluatePage } from "./core.mjs";

const GeouraContext = createContext(null);

export function GeouraProvider({ children, siteId, publicKey = "", apiBase = "https://api.geoura.com", enabled = true }) {
  const client = useMemo(() => enabled ? createGeouraClient({ siteId, publicKey, apiBase }) : null, [siteId, publicKey, apiBase, enabled]);
  const value = useMemo(() => ({ client, enabled, siteId }), [client, enabled, siteId]);
  return createElement(GeouraContext.Provider, { value }, children);
}

export function GeouraPageObserver({ send = false, onResult }) {
  const context = useGeoura();
  useEffect(() => {
    if (!context.enabled || typeof document === "undefined") return;
    const signals = collectPageSignals(document);
    const local = evaluatePage(signals);
    onResult?.({ signals, local });
    if (send && context.client) context.client.analyze(signals).then(remote => onResult?.({ signals, local, remote })).catch(() => {});
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
  const { client, enabled } = useGeoura();
  return useCallback(async (name, details = {}) => {
    if (!enabled || !client) return { skipped: true };
    return client.trackConversion({ name, pageUrl: details.pageUrl || globalThis.location?.href || "", value: details.value, leadId: details.leadId });
  }, [client, enabled]);
}

export { buildBriefInput, buildContentInput, classifyPage, collectPageSignals, createGeouraAdminClient, createGeouraClient, detectPlatform, evaluatePage } from "./core.mjs";
