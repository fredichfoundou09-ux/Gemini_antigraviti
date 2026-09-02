import { createClient } from '@supabase/supabase-js';

const url = 'https://tvcuwhgqhrcvdgwlviju.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2Y3V3aGdxaHJjdmRnd2x2aWp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MDUxMDEsImV4cCI6MjEwMjM4MTEwMX0.Wv1hEaaGfmydRPrhNUThZAo85nF9peTi3arNn619AW8';

const supabase = createClient(url, key);

async function main() {
  await supabase.auth.signInWithPassword({
    email: 'fredichfoundou09@gmail.com',
    password: 'Sentinelle066328874//'
  });

  console.log("Testing direct insert to conversations...");
  const { data: conv, error: convErr } = await supabase.from('conversations').insert({
    subject: 'Test direct insert'
  }).select().single();
  console.log("Conv insert result:", conv, "Error:", convErr);

  if (conv) {
    console.log("Testing insert to conversation_members...");
    const { data: member, error: memErr } = await supabase.from('conversation_members').insert({
      conversation_id: conv.id,
      user_id: '681f86b4-862f-423a-b238-0d571e987bf6'
    }).select().single();
    console.log("Member insert result:", member, "Error:", memErr);

    console.log("Testing insert to messages...");
    const { data: msg, error: msgErr } = await supabase.from('messages').insert({
      conversation_id: conv.id,
      sender_id: '681f86b4-862f-423a-b238-0d571e987bf6',
      body: 'Test message body'
    }).select().single();
    console.log("Message insert result:", msg, "Error:", msgErr);
  }

  // Check notifications table schema
  console.log("\nChecking notifications table columns...");
  const { data: notif, error: notifErr } = await supabase.from('notifications').select('*').limit(1);
  console.log("Notifications select:", notif, "Error:", notifErr);
}

main();
