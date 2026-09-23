import { createArticleJsonLd, createGeouraMetadata } from "@geoura/react/next";

const canonical = "https://www.tironitech.com/blog/exemplo";

export const metadata = createGeouraMetadata({
  title: "Título específico do artigo | Tironi Tech",
  description: "Descrição que explica claramente o problema resolvido.",
  canonical,
  authors: ["Tironi Tech"],
});

export default function ArticleExample() {
  const jsonLd = createArticleJsonLd({
    url: canonical,
    headline: "Título específico do artigo",
    description: "Descrição que explica claramente o problema resolvido.",
    author: "Tironi Tech",
    publisher: "Tironi Tech",
    datePublished: "2026-09-21",
  });
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd)}} /><article>{/* conteúdo */}</article></>;
}
