import { ConvexClient } from "convex/browser";

// Set your Convex URL from your environment variables
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || "http://localhost:3210"; 
export const convex = new ConvexClient(CONVEX_URL);
