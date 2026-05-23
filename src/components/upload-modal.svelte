<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import exifr from 'exifr';
  import { convex } from '../lib/convex';
  import { api } from '../../convex/_generated/api';
  import { EMOJI_CATEGORIES } from '../lib/constants';

  export let show = false;

  const dispatch = createEventDispatcher();

  let file: File | null = null;
  let title = '';
  let description = '';
  let google_maps_link = '';
  let uploading = false;
  let error = '';

  let selectedEmoji = '📍';

  let lat: number | null = null;
  let lng: number | null = null;
  let camera = '';
  let shutter = '';
  let iso = '';
  let timestamp: number | null = null;

  function close() {
    show = false;
    resetForm();
    dispatch('close');
  }

  function resetForm() {
    file = null;
    title = '';
    description = '';
    google_maps_link = '';
    error = '';
    lat = null;
    lng = null;
    camera = '';
    shutter = '';
    iso = '';
    timestamp = null;
    selectedEmoji = '📍';
  }

  async function handleFileSelect(e: Event) {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      file = target.files[0];
      error = '';
      
      try {
        // Parse metadata using exifr
        const exif = await exifr.parse(file, true);
        
        if (exif && exif.latitude && exif.longitude) {
          lat = exif.latitude;
          lng = exif.longitude;
        } else {
          error = 'ფოტოში GPS კოორდინატები ვერ მოიძებნა!';
        }

        if (exif) {
          camera = exif.Model ? `${exif.Make || ''} ${exif.Model}`.trim() : '';
          iso = exif.ISO ? `ISO ${exif.ISO}` : '';
          shutter = exif.ExposureTime ? `1/${Math.round(1 / exif.ExposureTime)}s` : '';
          timestamp = exif.DateTimeOriginal ? new Date(exif.DateTimeOriginal).getTime() : Date.now();
        }
      } catch (err) {
        console.error('Failed to parse EXIF', err);
        error = 'მეტამონაცემების წაკითხვა ვერ მოხერხდა. დარწმუნდი, რომ ორიგინალი ფოტოა.';
      }
    }
  }

  function removePhoto() {
    file = null;
    camera = '';
    shutter = '';
    iso = '';
    timestamp = null;
    error = '';
  }

  async function uploadPhoto() {
    if (lat === null || lng === null) {
      error = 'გთხოვ მიუთითო კოორდინატები (შეიყვანე ხელით ან მონიშნე რუკაზე).';
      return;
    }

    if (!title.trim()) {
      error = 'გთხოვ მიუთითო სათაური.';
      return;
    }

    uploading = true;
    error = '';

    try {
      let storageId: any = undefined;

      if (file) {
        // 1. Get an upload URL from Convex
        const postUrl = await convex.mutation(api.photos.generateUploadUrl, {});

        // 2. POST the file to the URL
        const result = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        
        const response = await result.json();
        storageId = response.storageId;
      }

      // 3. Save the photo (if uploaded) and metadata into the Convex DB
      await convex.mutation(api.photos.savePhoto, {
        storageId,
        title,
        description,
        google_maps_link,
        coordinates: [lng, lat],
        emojiType: selectedEmoji === '📍' ? undefined : selectedEmoji,
        camera: file ? camera : undefined,
        shutter: file ? shutter : undefined,
        iso: file ? iso : undefined,
        timestamp: file ? (timestamp || Date.now()) : undefined
      });

      close();
    } catch (err: any) {
      error = err.message || 'ლოკაციის შენახვისას დაფიქსირდა შეცდომა';
    } finally {
      uploading = false;
    }
  }

  // Allow parent to programmatically set coordinates (used when user clicks on the map)
  export function setCoordinates(newLat: number, newLng: number) {
    lat = newLat;
    lng = newLng;
    error = '';
  }
</script>

{#if show}
<div class="modal-backdrop" on:click={close}>
  <div class="modal-content" on:click|stopPropagation>
    <div class="modal-header">
      <h2>ფოტოს და ლოკაციის ატვირთვა</h2>
      <button class="close-btn" on:click={close}>&times;</button>
    </div>

    {#if error}
      <div class="error"><i class="fas fa-exclamation-circle"></i> {error}</div>
    {/if}

    <div class="form-group file-group">
      <label>ფოტო (არასავალდებულო)</label>
      {#if !file}
        <label class="file-label" for="photo">
          <i class="fas fa-image"></i> აირჩიე ფოტო
        </label>
        <input type="file" id="photo" accept="image/*" on:change={handleFileSelect} />
      {:else}
        <div class="file-details">
          <div class="file-info-row">
            <span class="file-name"><i class="fas fa-image"></i> {file.name}</span>
            <button class="btn-remove-photo" type="button" on:click={removePhoto} title="ფოტოს წაშლა">
              <i class="fas fa-times"></i> წაშლა
            </button>
          </div>
          
          <div class="gps-status-container">
            {#if lat !== null && lng !== null}
              <small class="success"><i class="fas fa-map-marker-alt"></i> GPS კოორდინატები ნაპოვნია</small>
            {:else}
              <small class="warning"><i class="fas fa-exclamation-triangle"></i> ფოტოში GPS ვერ მოიძებნა</small>
            {/if}
          </div>
          
          {#if camera || shutter || iso}
            <div class="meta-pills">
              {#if camera}<span class="pill"><i class="fas fa-camera"></i> {camera}</span>{/if}
              {#if shutter}<span class="pill"><i class="fas fa-stopwatch"></i> {shutter}</span>{/if}
              {#if iso}<span class="pill"><i class="fas fa-sun"></i> {iso}</span>{/if}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Coordinate selection is ALWAYS visible -->
    <div class="form-group">
      <label>კოორდინატები *</label>
      <div class="manual-coords">
        {#if lat === null || lng === null}
          <p class="coords-help">შეგიძლია მონიშნო ადგილი რუკაზე ან შეიყვანო კოორდინატები ხელით.</p>
        {/if}
        <div class="coords-row">
          <button class="btn-mark" type="button" on:click={() => dispatch('requestMark')}>
            <i class="fas fa-map-pin"></i> რუკაზე მონიშვნა
          </button>
          <div class="coords-inputs">
            <div class="input-wrapper">
              <span class="input-prefix">LAT</span>
              <input type="number" step="any" placeholder="განედი" bind:value={lat} />
            </div>
            <div class="input-wrapper">
              <span class="input-prefix">LNG</span>
              <input type="number" step="any" placeholder="გრძედი" bind:value={lng} />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="form-group">
      <label for="title">სათაური *</label>
      <input type="text" id="title" bind:value={title} placeholder="მაგ. ლამაზი მზის ჩასვლის ადგილი" />
    </div>

    <div class="form-group">
      <label for="description">აღწერა</label>
      <textarea id="description" bind:value={description} placeholder="მოგვიყევი ამ ადგილის შესახებ..."></textarea>
    </div>

    <div class="form-group">
      <label>კატეგორია (აირჩიე ერთი)</label>
      <div class="category-select-grid">
        {#each EMOJI_CATEGORIES as cat}
          <button
            type="button"
            class="category-select-btn {selectedEmoji === cat.emoji ? 'active' : ''}"
            on:click={() => selectedEmoji = cat.emoji}
            title="{cat.emoji} {cat.description}"
          >
            <span class="btn-emoji">{cat.emoji}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="form-group">
      <label for="gmaps">Google Maps-ის ლინკი (არასავალდებულო)</label>
      <input type="text" id="gmaps" bind:value={google_maps_link} placeholder="https://maps.google.com/..." />
    </div>

    <div class="actions">
      <button class="btn-cancel" on:click={close} disabled={uploading}>გაუქმება</button>
      <button class="btn-upload" on:click={uploadPhoto} disabled={uploading || !title.trim() || lat === null || lng === null}>
        {#if uploading}
          <i class="fas fa-spinner fa-spin"></i> იტვირთება...
        {:else}
          <i class="fas fa-paper-plane"></i> {file ? 'ატვირთვა და შენახვა' : 'ლოკაციის შენახვა'}
        {/if}
      </button>
    </div>
  </div>
</div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
  .modal-content {
    background: #282c33;
    color: #f0f0f0;
    border-radius: 12px;
    padding: 24px;
    width: 90%;
    max-width: 450px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    border: 1px solid #3e4451;
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  .modal-header h2 { margin: 0; font-size: 1.4rem; color: #61dafb; }
  .close-btn { 
    background: none; border: none; font-size: 1.8rem; color: #f0f0f0; 
    cursor: pointer; padding: 0; margin: 0; line-height: 1; 
  }
  .close-btn:hover { color: #61dafb; }

  .form-group {
    margin-bottom: 18px;
    display: flex;
    flex-direction: column;
  }
  label {
    font-size: 0.9rem;
    font-weight: 500;
    margin-bottom: 6px;
    color: #abb2bf;
  }
  input, textarea {
    background: #1e2227;
    color: #f0f0f0;
    padding: 10px 12px;
    border: 1px solid #3e4451;
    border-radius: 6px;
    font-size: 1rem;
    font-family: inherit;
    transition: border-color 0.2s;
  }
  input:focus, textarea:focus {
    outline: none;
    border-color: #61dafb;
  }
  textarea { min-height: 90px; resize: vertical; }

  input[type="file"] { display: none; }
  .file-label {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    background: #363b42;
    padding: 12px;
    border-radius: 6px;
    border: 1px dashed #61dafb;
    cursor: pointer;
    font-size: 1rem;
    color: #61dafb;
    transition: background 0.2s;
  }
  .file-label:hover { background: #3e4451; }
  
  .file-details {
    background: #1e2227;
    padding: 12px;
    border-radius: 6px;
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    border: 1px solid #3e4451;
  }
  .file-name { font-size: 0.9rem; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  
  .file-info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    margin-bottom: 4px;
  }
  
  .btn-remove-photo {
    background: transparent;
    border: none;
    color: #f48771;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    padding: 4px 8px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: all 0.2s ease;
    border-radius: 4px;
  }

  .btn-remove-photo:hover {
    background: rgba(244, 135, 113, 0.1);
    color: #ff9e8b;
  }

  .error { color: #f48771; margin-bottom: 16px; font-weight: 500; display: flex; align-items: center; gap: 8px; font-size: 0.95rem; }
  .success { color: #98c379; display: flex; align-items: center; gap: 6px; font-size: 0.85rem; font-weight: 500;}
  .warning { color: #d19a66; display: flex; align-items: center; gap: 6px; font-size: 0.85rem; font-weight: 500;}

  .gps-status-container {
    display: flex;
    align-items: center;
    margin-bottom: 4px;
  }
  
  .coords-help {
    margin: 6px 0 10px 0;
    color: #abb2bf;
    font-size: 0.85rem;
    line-height: 1.4;
  }

  .coords-row {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    margin-top: 6px;
  }
  
  @media (min-width: 380px) {
    .coords-row {
      flex-direction: row;
      align-items: center;
    }
  }

  .btn-mark {
    background: #363b42;
    color: #61dafb;
    border: 1px solid #61dafb;
    padding: 8px 14px;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    white-space: nowrap;
    transition: all 0.2s ease;
    height: 38px;
  }
  
  .btn-mark:hover {
    background: #61dafb;
    color: #282c33;
  }

  .coords-inputs {
    display: flex;
    gap: 8px;
    flex: 1;
    width: 100%;
  }

  .input-wrapper {
    display: flex;
    align-items: center;
    background: #1e2227;
    border: 1px solid #3e4451;
    border-radius: 6px;
    flex: 1;
    min-width: 0;
    height: 38px;
    box-sizing: border-box;
  }

  .input-wrapper:focus-within {
    border-color: #61dafb;
  }

  .input-prefix {
    font-size: 0.75rem;
    font-weight: bold;
    color: #61dafb;
    background: #282c33;
    padding: 0 6px;
    height: 100%;
    display: flex;
    align-items: center;
    border-right: 1px solid #3e4451;
    border-top-left-radius: 5px;
    border-bottom-left-radius: 5px;
    user-select: none;
  }

  .input-wrapper input {
    background: transparent;
    color: #f0f0f0;
    border: none;
    padding: 0 8px;
    width: 100%;
    height: 100%;
    font-size: 0.85rem;
    font-family: inherit;
    box-sizing: border-box;
  }
  
  .input-wrapper input:focus {
    outline: none;
  }

  .input-wrapper input::-webkit-outer-spin-button,
  .input-wrapper input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .input-wrapper input[type=number] {
    -moz-appearance: textfield;
  }

  .meta-pills { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
  .pill { background: #363b42; color: #abb2bf; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; display: flex; align-items: center; gap: 4px;}

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 28px;
  }
  button {
    padding: 10px 18px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: opacity 0.2s;
  }
  .btn-upload { background: #61dafb; color: #282c33; }
  .btn-upload:hover:not(:disabled) { opacity: 0.9; }
  .btn-upload:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-cancel { background: transparent; color: #abb2bf; border: 1px solid #3e4451;}
  .btn-cancel:hover { background: #363b42; color: #f0f0f0; }

  .category-select-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 6px;
  }

  .category-select-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 4px;
    background: #1e2227;
    border: 1px solid #3e4451;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    color: #abb2bf;
    min-height: 0;
  }

  .category-select-btn:hover {
    border-color: #61dafb;
    background: #2a2f36;
    color: #f0f0f0;
  }

  .category-select-btn.active {
    border-color: #61dafb;
    background: rgba(97, 218, 251, 0.12);
    color: #61dafb;
    box-shadow: 0 0 4px rgba(97, 218, 251, 0.2);
  }

  .btn-emoji {
    font-size: 1.1rem;
    line-height: 1;
  }
</style>
