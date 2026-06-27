var CACHE_NAME = 'accounting-v7';

var FILES_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

// Install — cache new files
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(FILES_TO_CACHE);
        })
    );
    // Purana SW turant hatao, naya activate karo
    self.skipWaiting();
});

// Activate — purana cache DELETE karo
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(keyList) {
            return Promise.all(
                keyList.map(function(key) {
                    // Purane SAARE caches delete
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    // Turant control lo sabhi tabs ka
    self.clients.claim();
});

// Fetch — PEHLE NETWORK, fir cache (Network First)
self.addEventListener('fetch', function(event) {
    event.respondWith(
        fetch(event.request)
            .then(function(response) {
                // Network se mila → cache me bhi update karo
                var responseClone = response.clone();
                caches.open(CACHE_NAME).then(function(cache) {
                    cache.put(event.request, responseClone);
                });
                return response;
            })
            .catch(function() {
                // Network fail → cache se do (offline mode)
                return caches.match(event.request);
            })
    );
});
