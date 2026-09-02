import { createClient } from '@supabase/supabase-js';

const url = 'https://tvcuwhgqhrcvdgwlviju.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2Y3V3aGdxaHJjdmRnd2x2aWp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MDUxMDEsImV4cCI6MjEwMjM4MTEwMX0.Wv1hEaaGfmydRPrhNUThZAo85nF9peTi3arNn619AW8';

const supabase = createClient(url, key);

async function test() {
  const res = await supabase.auth.signInWithPassword({
    email: 'fredichfoundou09@gmail.com',
    password: 'Sentinelle066328874//'
  });
  console.log("Full login response:", JSON.stringify(res, null, 2));
}

test();
