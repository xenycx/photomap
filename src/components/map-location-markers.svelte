<script lang="ts">
  import { mapContext } from "svelte-maplibre";
  import { Marker, Popup } from "maplibre-gl";
  import { onMount, onDestroy } from "svelte";
  import { markers, fetchMarkers, type Marker as MarkerData } from "../lib/markers-service";
  import { filteredMarkers, getSharedMarkerName, getShareUrl } from "../lib/filter-store";
  import { mapDarkMode } from "../lib/theme-store";
  import { userLocation } from "../lib/geolocation-store";
  import { favoriteNames, toggleFavorite, isFavorite } from "../lib/favorites-store";
  
  const { map } = mapContext();
  let markerObjects: { marker: Marker, popup: Popup, data: MarkerData }[] = [];
  let userMarker: Marker | null = null;
  export let showMarkers = true;
  let refreshInterval: ReturnType<typeof setInterval> | undefined;
  
  // Show or hide markers
  export function toggleMarkers(show: boolean) {
    showMarkers = show;
    if (!$map) return;
    if (show) {
      markerObjects.forEach(({ marker }) => marker.addTo($map));
    } else {
      markerObjects.forEach(({ marker }) => marker.remove());
    }
  }

  // Fly to a specific marker by name (used by sidebar)
  export function flyToMarker(name: string) {
    if (!$map) return;
    const found = markerObjects.find(m => m.data.name === name);
    if (found && found.data.coordinates) {
      const coords = found.data.coordinates as [number, number];
      $map.flyTo({ center: coords, zoom: 14, duration: 1200 });
      markerObjects.forEach(m => m.popup.remove());
      found.marker.togglePopup();
    }
  }

  // Build popup HTML for a marker
  function buildPopupHTML(markerData: MarkerData): string {
    const faves = getFavoritesSnapshot();
    const isFav = isFavorite(markerData.name, faves);
    const shareUrl = getShareUrl(markerData.name);
    
    return `
      <div class="marker-popup" id="popup-${markerData._id || markerData.name}">
        <div style="display:flex;justify-content:space-between;align-items:start;gap:8px;">
          <h3 style="margin:0;flex:1;">${markerData.name}</h3>
          <button class="fav-btn" data-name="${markerData.name.replace(/"/g, '&quot;')}" title="${isFav ? 'წაშალე ფავორიტებიდან' : 'დაამატე ფავორიტებში'}" style="background:none;border:none;cursor:pointer;font-size:1.2rem;padding:2px;">
            ${isFav ? '❤️' : '🤍'}
          </button>
        </div>
        ${markerData.description ? `<p>${markerData.description}</p>` : ''}
        
        <div class="photos-container" id="photos-${markerData._id}">
          <!-- Photos will be loaded here dynamically -->
        </div>

        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
          ${markerData.google_maps_link ? 
            `<a href="${markerData.google_maps_link}" target="_blank" rel="noopener noreferrer" class="gmaps-btn">
               <i class="fas fa-map-marker-alt"></i> Google Maps
             </a>` : ''}
          <button class="share-btn" data-url="${shareUrl}" title="გააზიარე">
            <i class="fas fa-share-alt"></i> გააზიარე
          </button>
        </div>
      </div>
    `;
  }

  function getFavoritesSnapshot(): string[] {
    let faves: string[] = [];
    const unsub = favoriteNames.subscribe(v => faves = v);
    unsub();
    return faves;
  }

  // Update markers on the map
  export function updateMarkers() {
    if (!$map) return;
    
    markerObjects.forEach(({ marker, popup }) => {
      marker.remove();
      popup.remove();
    });
    markerObjects = [];

    if ($filteredMarkers && $filteredMarkers.length > 0) {
      $filteredMarkers
        .filter(markerData => markerData.coordinates !== null)
        .forEach((markerData) => {
          const popup = new Popup({
            closeButton: true,
            closeOnClick: true,
            className: $mapDarkMode ? 'dark-mode' : '',
            maxWidth: '300px'
          }).setHTML(buildPopupHTML(markerData));

          popup.on('open', async () => {
            const popupEl = popup.getElement();
            if (!popupEl) return;

            // ... Existing favicon/share logic ...
            const favBtn = popupEl.querySelector('.fav-btn') as HTMLButtonElement;
            if (favBtn) {
              favBtn.addEventListener('click', () => {
                const name = favBtn.getAttribute('data-name') || '';
                toggleFavorite(name);
                popup.setHTML(buildPopupHTML(markerData));
              });
            }

            const shareBtn = popupEl.querySelector('.share-btn') as HTMLButtonElement;
            if (shareBtn) {
              shareBtn.addEventListener('click', async () => {
                const url = shareBtn.getAttribute('data-url') || '';
                try {
                  await navigator.clipboard.writeText(url);
                  shareBtn.innerHTML = '<i class="fas fa-check"></i> დაკოპირდა!';
                  setTimeout(() => {
                    shareBtn.innerHTML = '<i class="fas fa-share-alt"></i> გააზიარე';
                  }, 2000);
                } catch {
                  prompt('Copy this link:', url);
                }
              });
            }

            // Load Photos for this location
            if (markerData._id) {
              const photosContainer = popupEl.querySelector(`#photos-${markerData._id}`);
              if (photosContainer) {
                photosContainer.innerHTML = '<div style="font-size: 0.8rem; color: #888;">იტვირთება ფოტოები...</div>';
                try {
                  const { convex } = await import('../lib/convex');
                  const { api } = await import('../../convex/_generated/api');
                  const photos = await convex.query(api.photos.getPhotosForLocation, { locationId: markerData._id });
                  
                  if (photos.length > 0) {
                    photosContainer.innerHTML = photos.map((p: any) => `
                      <div style="margin-top: 8px;">
                        <a href="${p.url}" target="_blank">
                          <img src="${p.url}" style="width: 100%; border-radius: 4px; display: block;" />
                        </a>
                        <div style="font-size: 0.8rem; color: #aaa; margin-top: 4px;">
                          ${p.camera ? `📸 ${p.camera}` : ''}
                          ${p.shutter ? `⏱ ${p.shutter}` : ''}
                          ${p.iso ? `🔆 ${p.iso}` : ''}
                        </div>
                      </div>
                    `).join('');
                  } else {
                    photosContainer.innerHTML = '';
                  }
                } catch (e) {
                  photosContainer.innerHTML = '<div style="font-size: 0.8rem; color: red;">ფოტოების ჩატვირთვა ვერ მოხერხდა</div>';
                }
              }
            }
          });

          const el = document.createElement('div');
          el.className = 'marker';
          // Use an inner span for hover — never touch transform on
          // the outer element because MapLibre uses it for positioning.
          const inner = document.createElement('span');
          inner.className = 'marker-inner';
          inner.textContent = markerData.emojiType || '📍';
          el.appendChild(inner);
          
          const marker = new Marker({ element: el })
            .setLngLat(markerData.coordinates!)
            .setPopup(popup);
          
          if (showMarkers) {
            marker.addTo($map);
          }
          
          markerObjects.push({ marker, popup, data: markerData });
        });
    }
  }

  // Fly map to a specific coordinate
  export function flyToLocation(coords: [number, number], zoom: number = 13) {
    if (!$map) return;
    $map.flyTo({ center: coords, zoom, duration: 1200 });
  }

  // Allow parent to request a single map click to pick coordinates
  export function pickLocationOnce(): Promise<[number, number]> {
    return new Promise((resolve, reject) => {
      if (!$map) {
        reject(new Error('Map not ready'));
        return;
      }
      const handler = (e: any) => {
        try {
          const lng = e.lngLat.lng;
          const lat = e.lngLat.lat;
          resolve([lng, lat]);
        } catch (err) {
          reject(err);
        } finally {
          $map.off('click', handler);
        }
      };
      $map.once('click', handler);
    });
  }

  // Update user location marker
  function updateUserMarker(loc: [number, number] | null) {
    if (!$map) return;
    if (userMarker) {
      userMarker.remove();
      userMarker = null;
    }
    if (loc) {
      const el = document.createElement('div');
      el.className = 'user-marker-container';
      el.innerHTML = `
        <div class="user-pulse-ring"></div>
        <div class="user-accuracy-ring"></div>
        <div class="user-dot">
          <div class="user-dot-inner"></div>
        </div>
        <div class="user-label">ჩემი მდებარეობა</div>
      `;

      const popup = new Popup({ closeButton: true, closeOnClick: true, offset: 20 })
        .setHTML(`
          <div class="marker-popup">
            <h3>📍 ჩემი მდებარეობა</h3>
            <p style="margin:4px 0;font-size:0.85rem;color:#aaa;">კოორდინატები: ${loc[1].toFixed(4)}, ${loc[0].toFixed(4)}</p>
          </div>
        `);

      userMarker = new Marker({ element: el })
        .setLngLat(loc)
        .setPopup(popup)
        .addTo($map);
    }
  }

  function handleSharedMarker() {
    const sharedName = getSharedMarkerName();
    if (sharedName) {
      setTimeout(() => flyToMarker(decodeURIComponent(sharedName)), 800);
    }
  }

  $: if ($filteredMarkers) updateMarkers();
  $: if ($map) updateMarkers();
  $: if ($mapDarkMode !== undefined) updateMarkers();
  $: updateUserMarker($userLocation);

  onMount(() => {
    const unsubscribe = map.subscribe(value => {
      if (value) {
        fetchMarkers().then(() => {
          updateMarkers();
          handleSharedMarker();
        });
      }
    });
    
    return () => {
      unsubscribe();
      if (refreshInterval) clearInterval(refreshInterval);
    };
  });

  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
    markerObjects.forEach(({ marker, popup }) => { marker.remove(); popup.remove(); });
    if (userMarker) userMarker.remove();
  });
</script>

<style>
  :global(.user-marker-container) {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    cursor: pointer;
  }

  :global(.user-dot) {
    position: absolute;
    width: 20px;
    height: 20px;
    background: #4285F4;
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 0 10px rgba(66, 133, 244, 0.5);
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :global(.user-dot-inner) {
    width: 6px;
    height: 6px;
    background: white;
    border-radius: 50%;
  }

  :global(.user-accuracy-ring) {
    position: absolute;
    width: 36px;
    height: 36px;
    background: rgba(66, 133, 244, 0.12);
    border: 1.5px solid rgba(66, 133, 244, 0.25);
    border-radius: 50%;
    z-index: 1;
  }

  :global(.user-pulse-ring) {
    position: absolute;
    width: 36px;
    height: 36px;
    border: 2px solid rgba(66, 133, 244, 0.5);
    border-radius: 50%;
    animation: user-pulse 2s ease-out infinite;
    z-index: 2;
  }

  :global(.user-label) {
    position: absolute;
    top: calc(100% + 4px);
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    font-size: 11px;
    font-weight: 600;
    color: #4285F4;
    background: rgba(255, 255, 255, 0.9);
    padding: 2px 6px;
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    pointer-events: none;
    z-index: 4;
  }

  @keyframes user-pulse {
    0% { transform: scale(1); opacity: 0.7; }
    100% { transform: scale(2.5); opacity: 0; }
  }

  :global(.marker-popup .share-btn) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    background-color: #4a515a;
    color: #f0f0f0;
    border: none;
    border-radius: 4px;
    font-size: 0.85rem;
    cursor: pointer;
    font-family: inherit;
    transition: background-color 0.2s;
    margin-top: 0;
    height: auto;
    line-height: normal;
  }

  :global(.marker-popup .share-btn:hover) {
    background-color: #5a6270;
  }
</style>
