// One place that knows the diary's public address. Canonical links, Open Graph tags, the
// sitemap and the structured-data blocks all read from here, so pointing the site at a
// custom domain is a one-line change (or a VITE_SITE_URL project variable on Vercel).
export const SITE_URL = (
  import.meta.env["VITE_SITE_URL"] || "https://moijournal.vercel.app"
).replace(/\/+$/, "");

export const SITE_NAME = "MoiJournal";

/** Turn a site path like "/signup" into the absolute URL search engines expect. */
export const absoluteUrl = (path = "/") => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
