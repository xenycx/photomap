import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  locations: defineTable({
    coordinates: v.array(v.number()), // [lng, lat]
    title: v.string(),
    description: v.string(),
    google_maps_link: v.optional(v.string()),
  }),
  
  photos: defineTable({
    locationId: v.id("locations"),
    storageId: v.id("_storage"),
    camera: v.optional(v.string()),
    shutter: v.optional(v.string()),
    iso: v.optional(v.string()),
    timestamp: v.optional(v.number()),
  }).index("by_location", ["locationId"]),
});
