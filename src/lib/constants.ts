import type { LngLatLike } from "maplibre-gl";

export const georgiaCenter = [43.5, 42.3] as LngLatLike; // Center of Georgia country

export interface MapStyle {
  label: string;
  url: string;
  desc: string;
}

export const MAP_STYLES: MapStyle[] = [
  { label: "Liberty", url: "https://tiles.openfreemap.org/styles/liberty", desc: "Colorful OSM" },
  { label: "Positron", url: "https://tiles.openfreemap.org/styles/positron", desc: "Clean light" },
  { label: "Bright", url: "https://tiles.openfreemap.org/styles/bright", desc: "Bright detailed" },
  { label: "Dark", url: "https://tiles.openfreemap.org/styles/dark", desc: "Dark mode" },
  { label: "Fiord", url: "https://tiles.openfreemap.org/styles/fiord", desc: "Teal dark" },
  { label: "Voyager", url: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json", desc: "Detailed street" },
  { label: "Dark Matter", url: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json", desc: "CARTO dark" },
  { label: "Positron (CARTO)", url: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json", desc: "CARTO light" },
];

// Categories for marker types
export interface EmojiCategory {
  emoji: string;
  name: string;
  description: string;
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  { emoji: '🍽️', name: 'food', description: 'საჭმელი' },
  { emoji: '🌲', name: 'park', description: 'პარკი' },
  { emoji: '☕', name: 'cafe', description: 'კაფე' },
  { emoji: '🍸', name: 'bar', description: 'ბარი/კლუბი' },
  { emoji: '🏨', name: 'hotel', description: 'სასტუმრო' },
  { emoji: '🛍️', name: 'market', description: 'მარკეტი' },
  { emoji: '🍴', name: 'restaurant', description: 'რესტორანი' },
  { emoji: '🎭', name: 'attraction', description: 'ატრაქციონი' },
  { emoji: '🏛️', name: 'museum', description: 'მუზეუმი' },
  { emoji: '🌳', name: 'nature', description: 'ბუნება' },
  { emoji: '🅿️', name: 'parking', description: 'პარკინგი' },
  { emoji: '🏥', name: 'hospital', description: 'საავადმყოფო' },
  { emoji: 'ℹ️', name: 'info', description: 'საინფორმაციო' },
  { emoji: '🗿', name: 'monument', description: 'მონუმენტი/ძეგლი' },
  { emoji: '🚆', name: 'transport', description: 'ტრანსპორტი' },
  { emoji: '🏖️', name: 'beach', description: 'სანაპირო' },
  { emoji: '⛰️', name: 'mountain', description: 'მთა' },
  { emoji: '⛪', name: 'church', description: 'ეკლესია/ტაძარი' }
];

// Helper function to get category by emoji
export function getCategoryByEmoji(emoji: string): EmojiCategory | undefined {
  return EMOJI_CATEGORIES.find(category => category.emoji === emoji);
}