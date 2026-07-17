/* global self, caches, Response */

const CACHE_PREFIX = "ghr-order";
const SHELL_CACHE_NAME = `${CACHE_PREFIX}-shell-v3`;
const RUNTIME_CACHE_NAME = `${CACHE_PREFIX}-runtime-v3`;
const APP_SHELL = ["/", "/manifest.webmanifest", "/pwa-icon-192.png", "/pwa-icon-512.png"];

async function cacheResponse(cacheName, request, response) {
  if (!response || !response.ok) return response;

  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  } catch {
    // Cache failures must never block the live network response.
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    return cacheResponse(RUNTIME_CACHE_NAME, request, response);
  } catch {
    return (
      (await caches.match(request)) ||
      (await caches.match("/")) ||
      Response.error()
    );
  }
}

async function staleWhileRevalidate(request, event) {
  const cached = await caches.match(request);
  const networkRequest = fetch(request)
    .then((response) => cacheResponse(RUNTIME_CACHE_NAME, request, response))
    .catch(() => null);

  if (cached) {
    event.waitUntil(networkRequest);
    return cached;
  }

  return (await networkRequest) || Response.error();
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => null)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith(CACHE_PREFIX) &&
              key !== SHELL_CACHE_NAME &&
              key !== RUNTIME_CACHE_NAME
          )
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (
    isSameOrigin &&
    requestUrl.pathname !== "/service-worker.js" &&
    ["script", "style", "font", "image"].includes(event.request.destination)
  ) {
    event.respondWith(staleWhileRevalidate(event.request, event));
  }
});
