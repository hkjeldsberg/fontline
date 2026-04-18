import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type FontRow = {
  id: string;
  name: string;
  units_per_em: number;
  ascender: number;
  descender: number;
  created_at: string;
  updated_at: string;
};

export type GlyphConfigRow = {
  font_id: string;
  char_code: number;
  vertical_offset: number;
  scale: number;
  rotation: number;
  svg_path: string;
  updated_at: string;
};

// We don't use typed Database<...> generic because supabase-js v2 enforces it strictly
// and FontLine's tables are a closed schema we control via schema.sql. Untyped client,
// typed rows at the callsite, is simpler and avoids fighting the generic.
// The `any` on the schema slot lets us both use the 'fontline' schema and accept mocks.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Supabase = SupabaseClient<any, any, any>;

/** The FontLine schema (PRD §7). Tables live here, not in `public`. */
export const FONTLINE_SCHEMA = 'fontline';

let client: Supabase | null = null;

export function getSupabase(): Supabase {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase env vars missing: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env',
    );
  }
  // `db.schema` sets the default schema for every `.from(...)` call. PostgREST still
  // needs the schema added to "Exposed schemas" in the dashboard — see supabase/schema.sql.
  client = createClient(url, key, { db: { schema: FONTLINE_SCHEMA } });
  return client;
}

// Allow tests to inject a mock client.
export function __setSupabaseForTests(mock: Supabase | null): void {
  client = mock;
}
