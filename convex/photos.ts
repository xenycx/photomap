import { mutation, action, internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

// Haversine formula to calculate distance between two coordinates in meters
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Radius of the earth in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const savePhoto = mutation({
  args: {
    storageId: v.optional(v.id("_storage")),
    title: v.string(),
    description: v.string(),
    google_maps_link: v.optional(v.string()),
    coordinates: v.array(v.number()), // [lng, lat]
    emojiType: v.optional(v.string()),
    camera: v.optional(v.string()),
    shutter: v.optional(v.string()),
    iso: v.optional(v.string()),
    timestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // 1. Fetch all locations to find if one is nearby (within 30 meters)
    const locations = await ctx.db.query("locations").collect();
    
    const PROXIMITY_THRESHOLD_METERS = 30;
    let targetLocationId = null;

    for (const loc of locations) {
      const [long, lat] = loc.coordinates;
      const distance = getDistance(args.coordinates[1], args.coordinates[0], lat, long);
      
      if (distance <= PROXIMITY_THRESHOLD_METERS) {
        targetLocationId = loc._id;
        break; // Attach to the first matched nearby location
      }
    }

    // 2. If no nearby location is found, create a new one
    if (!targetLocationId) {
      targetLocationId = await ctx.db.insert("locations", {
        coordinates: args.coordinates,
        title: args.title,
        description: args.description,
        google_maps_link: args.google_maps_link,
        emojiType: args.emojiType,
      });
    }

    // 3. Insert the photo only if storageId is provided
    if (args.storageId) {
      await ctx.db.insert("photos", {
        locationId: targetLocationId,
        storageId: args.storageId,
        camera: args.camera,
        shutter: args.shutter,
        iso: args.iso,
        timestamp: args.timestamp,
      });
    }

    return targetLocationId;
  },
});

// Fetch all locations to display markers on the map
export const getLocations = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("locations").collect();
  },
});

// Fetch all photos for a given location, with their usable URLs
export const getPhotosForLocation = query({
  args: { locationId: v.id("locations") },
  handler: async (ctx, args) => {
    const photos = await ctx.db
      .query("photos")
      .withIndex("by_location", (q) => q.eq("locationId", args.locationId))
      .collect();

    // Map through photos and get resolving URLs
    return Promise.all(
      photos.map(async (photo) => ({
        ...photo,
        url: await ctx.storage.getUrl(photo.storageId),
      }))
    );
  },
});
