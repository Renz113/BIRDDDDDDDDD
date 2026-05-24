const CACHE_NAME = "flappy-bird-club-v3";
const RUNTIME_CACHE = "flappy-bird-club-runtime-v3";
const OFFLINE_PAGE = "./offline.html";
const APP_SHELL = [
  "./",
  "./index.html",
  "./offline.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
];

function isCacheableResponse(response) {
  return response && response.status === 200 && (response.type === "basic" || response.type === "default");
}

async function cacheShellAsset(cache, asset) {
  try {
    await cache.add(asset);
  } catch (error) {
    // Ignore optional shell misses so one asset does not block install.
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(APP_SHELL.map((asset) => cacheShellAsset(cache, asset)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![CACHE_NAME, RUNTIME_CACHE].includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(event.request);
          if (isCacheableResponse(response)) {
            const runtimeCache = await caches.open(RUNTIME_CACHE);
            runtimeCache.put(event.request, response.clone());
          }
          return response;
        } catch (error) {
          return (await caches.match(event.request))
            || (await caches.match("./index.html"))
            || (await caches.match(OFFLINE_PAGE));
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      if (cached) {
        event.waitUntil(
          fetch(event.request)
            .then(async (response) => {
              if (!isCacheableResponse(response)) {
                return;
              }
              const runtimeCache = await caches.open(RUNTIME_CACHE);
              await runtimeCache.put(event.request, response.clone());
            })
            .catch(() => {})
        );
        return cached;
      }

      try {
        const response = await fetch(event.request);
        if (isCacheableResponse(response)) {
          const runtimeCache = await caches.open(RUNTIME_CACHE);
          await runtimeCache.put(event.request, response.clone());
        }
        return response;
      } catch (error) {
        if (event.request.destination === "image") {
          return caches.match("./icons/icon-192.png");
        }

        if (event.request.destination === "document") {
          return (await caches.match(OFFLINE_PAGE)) || (await caches.match("./index.html"));
        }

        return new Response("", {
          status: 503,
          statusText: "Offline",
        });
      }
    })()
  );
});
