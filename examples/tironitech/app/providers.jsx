"use client";

import { GeouraPageObserver, GeouraProvider } from "@geoura/react";

export function Providers({ children }) {
  return (
    <GeouraProvider
      siteId="tironitech"
      publicKey={process.env.NEXT_PUBLIC_GEOURA_KEY}
      apiBase={process.env.NEXT_PUBLIC_GEOURA_API || "https://api.geoura.com"}
    >
      <GeouraPageObserver send={false} />
      {children}
    </GeouraProvider>
  );
}
