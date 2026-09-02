import { createClient } from '@supabase/supabase-js';

const url = 'https://tvcuwhgqhrcvdgwlviju.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2Y3V3aGdxaHJjdmRnd2x2aWp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MDUxMDEsImV4cCI6MjEwMjM4MTEwMX0.Wv1hEaaGfmydRPrhNUThZAo85nF9peTi3arNn619AW8';

const supabase = createClient(url, key);

async function main() {
  await supabase.auth.signInWithPassword({
    email: 'fredichfoundou09@gmail.com',
    password: 'Sentinelle066328874//'
  });

  console.log("Checking site_settings table...");
  const { data, error } = await supabase.from('site_settings').select('*');
  console.log("Select site_settings result:", data, "Error:", error);

  console.log("\nTesting upsert to site_settings...");
  const { data: upData, error: upErr } = await supabase.from('site_settings').upsert({
    id: 'default',
    data: { test: true },
    updated_at: new Date().toISOString()
  }).select();
  console.log("Upsert result:", upData, "Error:", upErr);
}

main();
