import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// The app runs even before Supabase is wired: when the keys are missing we show
// a friendly setup screen instead of crashing. Once you add .env values and
// restart `npm run dev`, isConfigured flips to true and everything goes live.
export const isConfigured = Boolean(
  url && key && !url.includes("YOUR-PROJECT-REF")
);

export const supabase = isConfigured ? createClient(url, key) : null;

export const TABLE = "wishlist_items";
