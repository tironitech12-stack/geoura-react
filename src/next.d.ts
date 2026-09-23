export function createGeouraMetadata(input: {title:string;description:string;canonical:string;image?:string;authors?:string[]}): Record<string, unknown>;
export function createArticleJsonLd(input: {url:string;headline:string;description:string;author:string;publisher:string;image?:string;datePublished:string;dateModified?:string}): Record<string, unknown>;
export function JsonLd(props: {value:Record<string,unknown>}): {type:string;props:Record<string,unknown>};
