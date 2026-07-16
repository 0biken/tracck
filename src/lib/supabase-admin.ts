import { createClient } from '@supabase/supabase-js';

// Define a minimal Database schema type if we don't have a generated one yet.
// For now, we'll just use any for the tables, but we can refine it.
export const createAdminClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    // If we're missing env vars, return a mock client for local dev without a DB.
    console.warn('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Using mock admin client.');
    return {
      from: (table: string) => ({
        insert: async (data: unknown) => {
          console.log(`[Mock Supabase Admin] Insert into ${table}:`, data);
          return { data: Array.isArray(data) ? data : [data], error: null };
        },
        select: (_query: string) => ({
          eq: (_column: string, _value: unknown) => ({
            single: async () => ({ data: null, error: null }),
            then: (resolve: (value: unknown) => void) => resolve({ data: [], error: null })
          })
        })
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
