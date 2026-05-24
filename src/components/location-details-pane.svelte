<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { convex } from "../lib/convex";
  import { api } from "../../convex/_generated/api";
  import type { Marker } from "../lib/markers-service";
  import { hasVoted, recordVote } from "../lib/voting-store";

  const dispatch = createEventDispatcher();

  export let locationData: Marker | null = null;
  let photos: any[] = [];
  let loadingPhotos = false;
  let error = "";
  
  let isEditing = false;
  let editTitle = "";
  let editDescription = "";

  let currentLocId: string | undefined = undefined;

  $: if (locationData && locationData._id !== currentLocId) {
    currentLocId = locationData._id;
    loadPhotos(locationData._id);
    editTitle = locationData.name;
    editDescription = locationData.description;
    isEditing = false;
  }

  async function loadPhotos(locationId: string | undefined) {
    if (!locationId) return;
    loadingPhotos = true;
    error = "";
    photos = [];
    try {
      photos = await convex.query(api.photos.getPhotosForLocation, { locationId: locationId as any });
    } catch (err) {
      error = "ფოტოების ჩატვირთვა ვერ მოხერხდა"; // Failed to load photos
      console.error(err);
    } finally {
      loadingPhotos = false;
    }
  }

  async function handleSave() {
    if (!locationData || !locationData._id) return;
    try {
      await convex.mutation(api.photos.updateLocation, {
        locationId: locationData._id as any,
        title: editTitle,
        description: editDescription,
      });
      locationData.name = editTitle;
      locationData.description = editDescription;
      isEditing = false;
      dispatch('locationUpdated', locationData);
    } catch (err) {
      console.error("Failed to update location", err);
      alert("Failed to update location.");
    }
  }

  async function handleVote(isUpvote: boolean) {
    if (!locationData || !locationData._id) return;
    
    if (hasVoted(locationData._id)) {
      alert('თქვენ უკვე დააფიქსირეთ თქვენი ხმა ამ ლოკაციაზე! (You already voted)');
      return;
    }
    recordVote(locationData._id, isUpvote ? 'upvote' : 'downvote');

    // Optimistic Update
    if (isUpvote) {
       locationData.upvotes = (locationData.upvotes || 0) + 1;
    } else {
       locationData.downvotes = (locationData.downvotes || 0) + 1;
    }
    locationData = { ...locationData }; // Reactivity trigger

    try {
      await convex.mutation(api.photos.voteAccuracy, {
        locationId: locationData._id as any,
        isUpvote
      });
      dispatch('locationUpdated', locationData);
    } catch (err) {
      console.error("Vote failed", err);
      // Rollback on failure
      if (isUpvote) locationData.upvotes = (locationData.upvotes || 1) - 1;
      else locationData.downvotes = (locationData.downvotes || 1) - 1;
      locationData = { ...locationData };
      dispatch('locationUpdated', locationData);
    }
  }
</script>

<div class="location-details">
  {#if locationData}
    <button class="back-btn" on:click={() => dispatch('back')}>
      <i class="fas fa-arrow-left"></i> უკან
    </button>
    
    {#if isEditing}
      <div class="edit-form">
        <label>
          სათაური:
          <input type="text" bind:value={editTitle} />
        </label>
        <label>
          აღწერა:
          <textarea bind:value={editDescription} rows="4"></textarea>
        </label>
        <div class="actions">
          <button on:click={handleSave} class="btn-save">შენახვა</button>
          <button on:click={() => isEditing = false} class="btn-cancel">გაუქმება</button>
        </div>
      </div>
    {:else}
      <div class="location-header">
        <h2 style="margin-bottom: 4px;">{locationData.emojiType || '📍'} {locationData.name}</h2>
        <button on:click={() => isEditing = true} class="btn-edit" title="დეტალების რედაქტირება">
          <i class="fas fa-edit"></i>
        </button>
      </div>
      
      {#if locationData.description}
        <p class="description">{locationData.description}</p>
      {/if}

      <div class="votes">
        <span>სიზუსტე: </span>
        <button on:click={() => handleVote(true)} class="vote-btn">
          👍 {locationData.upvotes || 0}
        </button>
        <button on:click={() => handleVote(false)} class="vote-btn">
          👎 {locationData.downvotes || 0}
        </button>
      </div>
    {/if}

    <hr />
    <h3>ფოტოები ({photos.length})</h3>

    {#if loadingPhotos}
      <p>იტვირთება...</p>
    {:else if error}
      <p class="error">{error}</p>
    {:else if photos.length === 0}
      <p>ამ ლოკაციაზე ფოტოები არ მოიძებნა.</p>
    {:else}
      <div class="photos-grid">
        {#each photos as p}
          <div class="photo-card">
            <a href={p.url} target="_blank">
              <img src={p.url} alt="Location photo" loading="lazy" />
            </a>
            <div class="meta-pills">
              {#if p.camera}<span class="pill"><i class="fas fa-camera"></i> {p.camera}</span>{/if}
              {#if p.shutter}<span class="pill"><i class="fas fa-stopwatch"></i> {p.shutter}</span>{/if}
              {#if p.iso}<span class="pill"><i class="fas fa-sun"></i> {p.iso}</span>{/if}
            </div>
            {#if p.timestamp}
               <div class="date">{new Date(p.timestamp).toLocaleDateString()}</div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  {:else}
    <p>გთხოვთ აირჩიოთ ლოკაცია რუკიდან.</p>
  {/if}
</div>

<style>
  .location-details {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-bottom: 20px;
    color: #f0f0f0;
  }
  .back-btn {
    align-self: flex-start;
    background: transparent;
    border: none;
    color: #61dafb;
    cursor: pointer;
    font-size: 1rem;
    padding: 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .back-btn:hover {
    text-decoration: underline;
    color: #a0e9ff;
  }
  .location-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .btn-edit {
    background: transparent;
    border: none;
    color: #aaa;
    cursor: pointer;
    font-size: 1.2rem;
  }
  .btn-edit:hover {
    color: white;
  }
  .description {
    font-size: 0.95rem;
    color: #ccc;
    line-height: 1.4;
    white-space: pre-wrap;
    margin-top: 0;
  }
  .edit-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
    background: #282c33;
    padding: 12px;
    border-radius: 8px;
    border: 1px solid #444;
  }
  .edit-form label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-weight: bold;
    font-size: 0.9rem;
    color: #f0f0f0;
  }
  .edit-form input, .edit-form textarea {
    padding: 10px;
    border-radius: 6px;
    border: 1px solid #444;
    background: #1b1d22;
    color: white;
    font-family: inherit;
  }
  .edit-form input:focus, .edit-form textarea:focus {
    outline: none;
    border-color: #61dafb;
  }
  .actions {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }
  .btn-save {
    background: #0074d9;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: bold;
  }
  .btn-save:hover {
    background: #005bb5;
  }
  .btn-cancel {
    background: #4a515a;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
  }
  .btn-cancel:hover {
    background: #5c646e;
  }
  .votes {
    display: flex;
    gap: 8px;
    align-items: center;
    background: #282c33;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid #444;
  }
  .vote-btn {
    background: #3a3f47;
    border: none;
    color: white;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .vote-btn:hover {
     background: #4a515a;
  }
  hr {
    border: 0;
    border-top: 1px solid #444;
    margin: 8px 0;
  }
  h3 {
    margin: 0;
    font-size: 1.2rem;
  }
  .photos-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
  }
  .photo-card {
    background: #282c33;
    border-radius: 8px;
    padding: 12px;
    border: 1px solid #444;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
  .photo-card img {
    width: 100%;
    border-radius: 6px;
    display: block;
  }
  .meta-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .pill {
    background: #1b1d22;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    color: #eee;
    border: 1px solid #333;
  }
  .date {
    font-size: 0.75rem;
    color: #888;
    text-align: right;
  }
  .error {
    color: #ff6b6b;
  }
</style>