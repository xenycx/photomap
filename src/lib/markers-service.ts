import type { LngLatLike } from "maplibre-gl";
import { writable } from 'svelte/store';
import { convex } from "./convex";
import { api } from "../../convex/_generated/api";

export interface Marker {
  _id?: string;
  name: string;
  description: string;
  coordinates: LngLatLike | null;
  google_maps_link: string;
  emojiType?: string;
  timestamp?: Date;
}

export const markers = writable<Marker[]>([]);
export const markersError = writable<string | null>(null);
export const markersLoading = writable<boolean>(false);

export async function fetchMarkers(): Promise<void> {
  try {
    markersError.set(null);
    markersLoading.set(true);
    
    const locations = await convex.query(api.photos.getLocations, {});

    const parsedMarkers: Marker[] = locations.map((loc) => ({
      _id: loc._id,
      name: loc.title,
      description: loc.description,
      coordinates: loc.coordinates as [number, number],
      google_maps_link: loc.google_maps_link ?? '',
      emojiType: loc.emojiType || '📍',
      timestamp: new Date(),
    }));

    markers.set(parsedMarkers);
  } catch (error) {
    console.error('Error fetching markers:', error);
    markers.set([]);
    markersError.set(error instanceof Error ? error.message : 'Failed to fetch markers');
  } finally {
    markersLoading.set(false);
  }
}
