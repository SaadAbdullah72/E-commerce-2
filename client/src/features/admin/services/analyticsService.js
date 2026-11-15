import { supabase } from '@/lib/supabase/client';

import { parseCatalogStats } from '../lib/catalogStats';

const FAILED = "We couldn't load the analytics. Please try again.";

/**
 * Real catalog numbers for the Analytics page, worked out by the database function
 * `admin_catalog_stats()`. The function itself refuses anyone who is not an admin.
 */
export async function getCatalogStats() {
  const { data, error } = await supabase.rpc('admin_catalog_stats');
  if (error) throw new Error(FAILED);
  try {
    return parseCatalogStats(data);
  } catch {
    throw new Error(FAILED);
  }
}
