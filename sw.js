// Minimal service worker: satisfies PWA installability (fetch handler present)
// and caches the app-shell files so the last-opened screen still loads with
// no signal. Adapted from the wordrun-johngospel sw.js pattern.
// ★내용을 바꿔 배포할 때는 이 버전 문자열을 올린다(옛 캐시가 통째로 버려진다).
const CACHE_NAME = "gwangju-yuan-shell-v2";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  // 화면을 만드는 스크립트. 못 받아도 index.html 안의 내용이 그대로 보인다.
  "./firebase-config.js",
  "./content.js",
  // 사진은 예전에 index.html 안에 박혀 있던 것을 파일로 뺀 것이다. 여기 담아 두어야
  // 인터넷이 없을 때도 예전과 똑같이 사진까지 보인다.
  "./img/hero-portrait.png",
  "./img/staff-1.jpg",
  "./img/staff-2.jpg",
  "./img/map.png",
  "./img/path-portrait.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
