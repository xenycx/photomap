<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import exifr from 'exifr';
  import { convex } from '../lib/convex';
  import { api } from '../../convex/_generated/api';

  export let show = false;

  const dispatch = createEventDispatcher();

  let file: File | null = null;
  let title = '';
  let description = '';
  let google_maps_link = '';
  let uploading = false;
  let error = '';

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

  async function uploadPhoto() {
    if (!file || lat === null || lng === null) {
      error = 'გთხოვ აირჩიო ფოტო და მიუთითე კოორდინატები ან მონიშნე რუკაზე.';
      return;
    }

    if (!title.trim()) {
      error = 'გთხოვ მიუთითო სათაური.';
      return;
    }

    uploading = true;
    error = '';

    try {
      // 1. Get an upload URL from Convex
      const postUrl = await convex.mutation(api.photos.generateUploadUrl);

      // 2. POST the file to the URL
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      
      const { storageId } = await result.json();

      // 3. Save the photo and metadata into the Convex DB
      await convex.mutation(api.photos.savePhoto, {
        storageId,
        title,
        description,
        google_maps_link,
        coordinates: [lng, lat],
        camera,
        shutter,
        iso,
        timestamp: timestamp || Date.now()
      });

      close();
    } catch (err: any) {
      error = err.message || 'ფოტოს ატვირთვისას დაფიქსირდა შეცდომა';
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
      <label class="file-label" for="photo">
        <i class="fas fa-cloud-upload-alt"></i> აირჩიე ფოტო
      </label>
      <input type="file" id="photo" accept="image/*" on:change={handleFileSelect} />
      
      {#if file}
        <div class="file-details">
          <span class="file-name"><i class="fas fa-image"></i> {file.name}</span>
          {#if lat && lng}
            <small class="success"><i class="fas fa-map-marker-alt"></i> GPS ნაპოვნია</small>
          {:else}
            <small class="warning"><i class="fas fa-exclamation-triangle"></i> GPS ვერ მოიძებნა</small>
            <div class="manual-coords">
              <p style="margin:6px 0;color:#ccc;font-size:0.9rem;">შეგიძლია მონიშნო ადგილი რუკაზე ან შეიყვანო კოორდინატები دستی.</p>
              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                <button class="btn-mark" on:click={() => dispatch('requestMark')}>რუკაზე მონიშნე</button>
                <div style="display:flex;gap:6px;align-items:center;">
                  <input type="number" step="any" placeholder="Latitude (მაგ. 41.715)" bind:value={lat} />
                  <input type="number" step="any" placeholder="Longitude (მაგ. 44.827)" bind:value={lng} />
                </div>
              </div>
            </div>
          {/if}
          
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

    <div class="form-group">
      <label for="title">სათაური *</label>
      <input type="text" id="title" bind:value={title} placeholder="მაგ. ლამაზი მზის ჩასვლის ადგილი" />
    </div>

    <div class="form-group">
      <label for="description">აღწერა</label>
      <textarea id="description" bind:value={description} placeholder="მოგვიყევი ამ ადგილის შესახებ..."></textarea>
    </div>

    <div class="form-group">
      <label for="gmaps">Google Maps-ის ლინკი (არასავალდებულო)</label>
      <input type="text" id="gmaps" bind:value={google_maps_link} placeholder="https://maps.google.com/..." />
    </div>

    <div class="actions">
      <button class="btn-cancel" on:click={close} disabled={uploading}>გაუქმება</button>
      <button class="btn-upload" on:click={uploadPhoto} disabled={uploading || !file}>
        {#if uploading}
          <i class="fas fa-spinner fa-spin"></i> იტვირთება...
        {:else}
          <i class="fas fa-paper-plane"></i> ატვირთვა
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
  
  .error { color: #f48771; margin-bottom: 16px; font-weight: 500; display: flex; align-items: center; gap: 8px; font-size: 0.95rem; }
  .success { color: #98c379; display: flex; align-items: center; gap: 6px; font-size: 0.85rem; font-weight: 500;}
  .warning { color: #d19a66; display: flex; align-items: center; gap: 6px; font-size: 0.85rem; font-weight: 500;}

  .meta-pills { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px; }
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
</style>
