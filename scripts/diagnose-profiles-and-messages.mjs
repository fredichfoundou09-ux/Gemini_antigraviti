import { createClient } from '@supabase/supabase-js';

const url = 'https://tvcuwhgqhrcvdgwlviju.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2Y3V3aGdxaHJjdmRnd2x2aWp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MDUxMDEsImV4cCI6MjEwMjM4MTEwMX0.Wv1hEaaGfmydRPrhNUThZAo85nF9peTi3arNn619AW8';

const supabase = createClient(url, key);

async function main() {
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'fredichfoundou09@gmail.com',
    password: 'Sentinelle066328874//'
  });

  if (authErr) {
    console.error("Auth error:", authErr.message);
    return;
  }

  console.log("Logged in user:", auth.user.id);

  // 1. Profiles
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, username, role, name, email');
  console.log(`\nProfiles (${profiles?.length}):`, pErr || profiles);

  // 2. Students & their user_id
  const { data: students, error: sErr } = await supabase.from('students').select('id, nom, prenom, user_id');
  console.log(`\nStudents (${students?.length}):`, sErr || students);

  // 3. Teachers & their user_id
  const { data: teachers, error: tErr } = await supabase.from('teachers').select('id, nom, prenom, user_id');
  console.log(`\nTeachers (${teachers?.length}):`, tErr || teachers);

  // 4. Conversations & Messages
  const { data: convs, error: cErr } = await supabase.from('conversations').select('*, members:conversation_members(*), messages(*)');
  console.log(`\nConversations (${convs?.length}):`, cErr || convs);

  // 5. Test RPC create_conversation
  console.log("\nTesting RPC create_conversation with user itself...");
  const { data: rpcRes, error: rpcErr } = await supabase.rpc('create_conversation', {
    p_subject: 'Test Audit System',
    p_member_ids: [auth.user.id],
    p_initial_message: 'Bonjour ceci est un test audit'
  });
  console.log("RPC create_conversation result:", rpcRes, "Error:", rpcErr);
}

main();
