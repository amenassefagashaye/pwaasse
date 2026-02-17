/* ========================================
   SERVICE-WORKER.JS - መርከብ ቢንጎ ጨዋታ PWA
   Insite Digital Group - Ethiopia
   Handles offline caching and network fallbacks
   ======================================== */

// Service Worker version - increment when files change
const SW_VERSION = '1.0.0';
const CACHE_NAME = `bingo-pwa-v${SW_VERSION}`;

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/icons/icon-72.png',
  '/icons/icon-96.png',
  '/icons/icon-128.png',
  '/icons/icon-144.png',
  '/icons/icon-152.png',
  '/icons/icon-167.png',
  '/icons/icon-180.png',
  '/icons/icon-192.png',
  '/icons/icon-256.png',
  '/icons/icon-512.png'
];

// API endpoints to cache (for offline fallback)
const API_ENDPOINTS = [
  // Add API endpoints if needed
  // '/api/boards',
  // '/api/game-state'
];

// ---------- INSTALL EVENT ----------
// Cache static assets on install
self.addEventListener('install', (event) => {
  console.log(`[ServiceWorker] Installing version ${SW_VERSION}`);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[ServiceWorker] Installation complete');
        return self.skipWaiting(); // Activate immediately
      })
      .catch((error) => {
        console.error('[ServiceWorker] Installation failed:', error);
      })
  );
});

// ---------- ACTIVATE EVENT ----------
// Clean up old caches on activate
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating');
  
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        // Delete old cache versions
        if (key !== CACHE_NAME) {
          console.log('[ServiceWorker] Removing old cache:', key);
          return caches.delete(key);
        }
      }));
    })
    .then(() => {
      console.log('[ServiceWorker] Activation complete');
      return self.clients.claim(); // Take control immediately
    })
  );
});

// ---------- FETCH EVENT ----------
// Strategy: Cache First, then Network with offline fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Handle different request types
  if (request.mode === 'navigate') {
    // HTML pages - Network first, fallback to cache
    event.respondWith(handleNavigation(request));
  } else if (STATIC_ASSETS.includes(url.pathname)) {
    // Static assets - Cache first
    event.respondWith(handleStaticAsset(request));
  } else if (url.pathname.startsWith('/api/')) {
    // API requests - Network first, fallback to cache
    event.respondWith(handleAPIRequest(request));
  } else {
    // Default - Cache first
    event.respondWith(handleDefault(request));
  }
});

// ---------- HANDLERS ----------
async function handleNavigation(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache the HTML for offline use
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[ServiceWorker] Navigation failed, falling back to cache');
    
    // Fallback to cached HTML
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Ultimate fallback - return cached index.html
    return caches.match('/index.html');
  }
}

async function handleStaticAsset(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    // Return cached version and update cache in background
    updateCache(request);
    return cachedResponse;
  }
  
  // Not in cache - fetch and cache
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[ServiceWorker] Failed to fetch static asset:', request.url);
    return new Response('Offline - Asset not available', { status: 503 });
  }
}

async function handleAPIRequest(request) {
  try {
    // Try network first for API
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[ServiceWorker] API request failed, using cached data');
    
    // Return cached API response
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Add offline header to indicate cached data
      const headers = new Headers(cachedResponse.headers);
      headers.append('X-Offline-Mode', 'true');
      
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers: headers
      });
    }
    
    // Return offline fallback for API
    return new Response(
      JSON.stringify({ 
        error: 'offline', 
        message: 'You are offline. Some features may be limited.' 
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

async function handleDefault(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok && shouldCache(request)) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[ServiceWorker] Fetch failed:', request.url);
    return new Response('Offline', { status: 503 });
  }
}

// ---------- UTILITY FUNCTIONS ----------
async function updateCache(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse);
      console.log('[ServiceWorker] Cache updated:', request.url);
    }
  } catch (error) {
    // Silent fail - keep using cached version
  }
}

function shouldCache(request) {
  // Only cache GET requests
  if (request.method !== 'GET') return false;
  
  // Don't cache analytics or tracking requests
  const url = new URL(request.url);
  if (url.pathname.includes('analytics') || 
      url.pathname.includes('tracking')) {
    return false;
  }
  
  return true;
}

// ---------- BACKGROUND SYNC ----------
// Listen for sync events (when coming back online)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-game-state') {
    console.log('[ServiceWorker] Background sync triggered');
    event.waitUntil(syncGameState());
  }
});

async function syncGameState() {
  try {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_READY',
        message: 'Connection restored. Syncing data...'
      });
    });
    
    // In production: sync with server
    console.log('[ServiceWorker] Game state sync complete');
  } catch (error) {
    console.error('[ServiceWorker] Sync failed:', error);
  }
}

// ---------- PUSH NOTIFICATIONS ----------
self.addEventListener('push', (event) => {
  const data = event.data.json();
  
  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});

// ---------- MESSAGE HANDLING ----------
self.addEventListener('message', (event) => {
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME);
  }
});

// Log successful registration
console.log('[ServiceWorker] Registered successfully');