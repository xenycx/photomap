<script lang="ts">
  import { onMount } from 'svelte';
  import { MapLibre } from "svelte-maplibre";
  import { georgiaCenter, MAP_STYLES } from "./lib/constants";
  import MapLocationMarkers from "./components/map-location-markers.svelte";
  import Sidebar from "./components/sidebar.svelte";
  import SidebarTab from "./components/sidebar-tab.svelte";
  import SidebarPane from "./components/sidebar-pane.svelte";
  import CategoryFilterPane from "./components/category-filter-pane.svelte";
  import LocationDetailsPane from "./components/location-details-pane.svelte";
  import UploadModal from "./components/upload-modal.svelte";
  import { mapStyleUrl } from "./lib/map-style-store";
  import { markers, fetchMarkers, markersError } from "./lib/markers-service";
  import { filteredMarkers } from "./lib/filter-store";
  import { favoriteMarkers, favoriteNames, toggleFavorite, isFavorite } from "./lib/favorites-store";
  import { userLocation, locateUser, geolocating } from "./lib/geolocation-store";
  import './app.css';
  
  // Sidebar state
  let sidebarCollapsed = true;
  let activeTab = 'home';
  let markersComponent: MapLocationMarkers;
  let uploadModal: any;
  let showMarkers = true;
  $: if (!$mapStyleUrl) $mapStyleUrl = MAP_STYLES[0].url; // default on first load
  let showFormPopup = false;
  
  let selectedLocationForDetails: any = null;

  function handleTabClick(tabId: string) {
    if (activeTab === tabId) {
      sidebarCollapsed = !sidebarCollapsed;
    } else {
      activeTab = tabId;
      sidebarCollapsed = false;
    }
  }
  
  function handleMarkersToggle() {
    showMarkers = !showMarkers;
    if (markersComponent) {
      markersComponent.toggleMarkers(showMarkers);
    }
  }
  
  function handleToggleForm() {
    showFormPopup = !showFormPopup;
  }
  
  async function handleRefresh() {
    await fetchMarkers();
    if (markersComponent) {
      markersComponent.updateMarkers();
    }
  }

  // When upload modal requests a map-mark, enable a one-shot pick on the markers component
  async function handleRequestMark() {
    showFormPopup = true;
    try {
      const coords = await markersComponent.pickLocationOnce();
      // coords is [lng, lat]
      if (uploadModal && typeof uploadModal.setCoordinates === 'function') {
        uploadModal.setCoordinates(coords[1], coords[0]);
      }
    } catch (e) {
      console.error('Marking failed', e);
    }
  }

  function handleCancelMark() {
    if (markersComponent && typeof markersComponent.cancelPickLocation === 'function') {
      markersComponent.cancelPickLocation();
    }
  }

  function handleFlyTo(name: string) {
    if (markersComponent) {
      markersComponent.flyToMarker(name);
    }
  }

  // Fly to user location when geolocation completes
  $: if ($userLocation && markersComponent) {
    markersComponent.flyToLocation($userLocation, 14);
  }

  function handleViewDetails(event: CustomEvent) {
    selectedLocationForDetails = event.detail.marker;
    activeTab = 'details';
    sidebarCollapsed = false;
  }

  function handleLocationUpdated(event: CustomEvent) {
     if (selectedLocationForDetails && event.detail && selectedLocationForDetails._id === event.detail._id) {
       selectedLocationForDetails = event.detail;
     }
     // Re-fetch markers when updated to ensure the Map popup is synced
     handleRefresh();
  }

  
  onMount(() => {
    fetchMarkers();
  });
</script>

<svelte:head>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" />
</svelte:head>

<div class="map-container">
  <MapLibre
    center={georgiaCenter}
    zoom={7}
    style={$mapStyleUrl}
  >
    <MapLocationMarkers 
      bind:this={markersComponent} 
      {showMarkers} 
      on:viewDetails={handleViewDetails}
    />
  </MapLibre>
  
  <Sidebar 
    position="left" 
    bind:collapsed={sidebarCollapsed} 
    on:toggleForm={handleToggleForm}
  >
    <svelte:fragment slot="tabs">
      <SidebarTab id="home" icon="fa-home" active={activeTab === 'home'} 
        on:click={() => handleTabClick('home')} />
      <SidebarTab id="favorites" icon="fa-heart" active={activeTab === 'favorites'} 
        on:click={() => handleTabClick('favorites')} />
      {#if selectedLocationForDetails}
        <SidebarTab id="details" icon="fa-camera-retro" active={activeTab === 'details'} 
          on:click={() => handleTabClick('details')} />
      {/if}
      <SidebarTab id="about" icon="fa-info-circle" active={activeTab === 'about'} 
        on:click={() => handleTabClick('about')} />
    </svelte:fragment>
    
    <svelte:fragment slot="content">
      <SidebarPane id="home" active={activeTab === 'home'}>
        <CategoryFilterPane 
          {showMarkers}
          onMarkersToggle={handleMarkersToggle}
          onRefresh={handleRefresh}
          onFlyTo={handleFlyTo}
        />
      </SidebarPane>

      <SidebarPane id="details" active={activeTab === 'details'}>
        <LocationDetailsPane 
           locationData={selectedLocationForDetails}
           on:back={() => handleTabClick('home')}
           on:locationUpdated={handleLocationUpdated}
        />
      </SidebarPane>

      <SidebarPane id="favorites" active={activeTab === 'favorites'}>
        <div class="favorites-pane">
          <h2>❤️ ფავორიტები</h2>
          {#if $favoriteMarkers.length > 0}
            <p class="fav-count">{$favoriteMarkers.length} შენახული ლოკაცია</p>
            <ul class="markers-list">
              {#each $favoriteMarkers as marker (marker.name)}
                <li class="marker-item">
                  <div class="marker-header">
                    <button class="marker-title-btn" on:click={() => handleFlyTo(marker.name)} title="რუკაზე ნახვა">
                      <span class="marker-emoji">{marker.emojiType || '📍'}</span>
                      {marker.name}
                    </button>
                    <button class="fav-toggle" on:click={() => toggleFavorite(marker.name)} title="წაშალე">
                      ❤️
                    </button>
                  </div>
                  {#if marker.description}
                    <p class="marker-description">{marker.description}</p>
                  {/if}
                </li>
              {/each}
            </ul>
          {:else}
            <div class="empty-favorites">
              <p>🤍</p>
              <p>ფავორიტები ცარიელია</p>
              <p class="hint">დააჭირე 🤍 მარკერზე რომ შეინახო</p>
            </div>
          {/if}
        </div>
      </SidebarPane>
      
      <SidebarPane id="about" active={activeTab === 'about'}>
        <h2>ინფორმაცია</h2>
        <p>საიდბარის ინსპირაცია აღებულია <b>sidebar-v2-დან</b>, იმპლემენტირებული <b>Svelte</b>-ში.</p>
        <p>აქ სხვა ელემენტების დამატება შეიძლება</p>
        <div class="setting-option">
          <label for="map-style-select">🗺️ რუკის სტილი</label>
          <select id="map-style-select" class="map-style-select" bind:value={$mapStyleUrl}>
            {#each MAP_STYLES as style}
              <option value={style.url}>{style.label} — {style.desc}</option>
            {/each}
          </select>
        </div>
      </SidebarPane>
    </svelte:fragment>
  </Sidebar>
</div>

<UploadModal bind:this={uploadModal} show={showFormPopup} on:requestMark={handleRequestMark} on:cancelMark={handleCancelMark} on:close={() => { showFormPopup = false; handleRefresh(); }} />

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: 'BPG Square Banner 2013', Arial, sans-serif;
  }
  
  .setting-option {
    padding: 10px 0;
  }
  
  .setting-option label {
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    color: #f0f0f0;
    margin-bottom: 6px;
  }

  .map-style-select {
    width: 100%;
    padding: 8px 10px;
    background: #1e2227;
    color: #f0f0f0;
    border: 1px solid #3e4451;
    border-radius: 6px;
    font-size: 0.9rem;
    font-family: inherit;
    cursor: pointer;
  }

  .map-style-select:focus {
    outline: none;
    border-color: #61dafb;
  }
  
  /* Popup styles */
  :global(.maplibregl-popup-content) {
    background-color: #363b42 !important;
    color: #f0f0f0 !important;
    padding: 12px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  
  :global(.maplibregl-popup-close-button) {
    color: #f0f0f0 !important;
  }
  
  :global(.maplibregl-popup-tip) {
    border-top-color: #363b42 !important;
  }
  
  /* Custom styling for inputs and checkboxes */
  :global(input[type="checkbox"]) {
    accent-color: #61dafb;
    width: 16px;
    height: 16px;
  }
  
  :global(.sidebar-pane a) {
    color: #61dafb;
    text-decoration: none;
  }
  
  :global(.sidebar-pane a:hover) {
    text-decoration: underline;
  }
  
  /* Darken the modal for map markers */
  :global(.marker-popup) {
    color: #f0f0f0;
  }
  
  :global(.marker-popup h3) {
    color: #f0f0f0;
    margin-top: 0;
  }
  
  :global(.marker-popup p) {
    color: #bbb;
  }
  
  :global(.marker-popup a) {
    display: inline-block;
    text-decoration: none;
    font-size: 0.85rem;
  }

  :global(.marker-popup a.gmaps-btn) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 0;
    padding: 6px 14px;
    background-color: #1a73e8;
    color: #fff;
    border-radius: 4px;
    font-size: 0.85rem;
    transition: background-color 0.2s;
  }

  :global(.marker-popup a.gmaps-btn:hover) {
    background-color: #1558b0;
    text-decoration: none;
  }

  :global(.marker-popup a.gmaps-btn i) {
    color: #ea4335;
  }
  
  /* Make sure marker emojis are visible */
  :global(.marker) {
    filter: drop-shadow(0px 1px 2px rgba(0,0,0,0.5));
  }

  /* Favorites pane */
  .favorites-pane {
    padding: 4px 0;
  }

  .favorites-pane h2 {
    margin-top: 0;
  }

  .fav-count {
    font-size: 0.9rem;
    color: #aaa;
    margin-bottom: 12px;
  }

  .empty-favorites {
    text-align: center;
    padding: 40px 20px;
    color: #888;
  }

  .empty-favorites p:first-child {
    font-size: 2.5rem;
    margin-bottom: 8px;
  }

  .empty-favorites .hint {
    font-size: 0.85rem;
    color: #666;
    margin-top: 8px;
  }

  .marker-title-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: none;
    border: none;
    color: #f0f0f0;
    cursor: pointer;
    font-weight: bold;
    font-size: 1rem;
    font-family: inherit;
    padding: 0;
    min-height: 32px;
    text-align: left;
    flex: 1;
    touch-action: manipulation;
    transition: color 0.2s;
  }

  .marker-title-btn:hover {
    color: #61dafb;
  }

  .fav-toggle {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.1rem;
    min-width: 32px;
    min-height: 32px;
    padding: 4px;
    transition: transform 0.2s;
    flex-shrink: 0;
    touch-action: manipulation;
  }

  .fav-toggle:hover {
    transform: scale(1.2);
  }

  .markers-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .marker-item {
    margin-bottom: 12px;
    padding: 12px;
    background-color: #363b42;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .marker-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }

  .marker-emoji {
    font-size: 1.2rem;
  }

  .marker-description {
    margin: 6px 0;
    font-size: 0.9rem;
    color: #bbb;
  }
</style>
