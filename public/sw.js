// MoiJournal's service worker. Deliberately almost empty: a diary is private and changes
// constantly, so nothing is cached or served from disk here. Browsers only offer "Install
// app" for a site that registers one, which is the entire reason this file exists.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
// A fetch listener is part of the installability criteria. Doing nothing in it keeps every
// request network-only, exactly like a site with no service worker at all.
self.addEventListener("fetch", () => {});
