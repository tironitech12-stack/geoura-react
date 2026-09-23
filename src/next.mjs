import { createElement } from "react";

export function createGeouraMetadata({ title, description, canonical, image, authors = [] }) {
  if (!title || !description || !canonical) throw new Error("title, description e canonical são obrigatórios.");
  return {
    title,
    description,
    alternates: { canonical },
    authors: authors.map(name => ({ name })),
    openGraph: {
      type: "article",
      title,
      description,
      url: canonical,
      ...(image ? { images: [{ url: image }] } : {}),
    },
  };
}

export function createArticleJsonLd({ url, headline, description, author, publisher, image, datePublished, dateModified }) {
  const value = {
    "@context": "https://schema.org",
    "@type": "Article",
    mainEntityOfPage: url,
    headline,
    description,
    author: { "@type": "Person", name: author },
    publisher: { "@type": "Organization", name: publisher },
    datePublished,
    dateModified: dateModified || datePublished,
  };
  if (image) value.image = [image];
  return value;
}

export function JsonLd({ value }) {
  return createElement("script", {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: JSON.stringify(value).replace(/</g, "\\u003c") },
  });
}
