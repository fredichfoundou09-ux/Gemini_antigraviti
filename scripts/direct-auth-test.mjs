async function testFetch() {
  const url = 'https://tvcuwhgqhrcvdgwlviju.supabase.co/auth/v1/token?grant_type=password';
  const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2Y3V3aGdxaHJjdmRnd2x2aWp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MDUxMDEsImV4cCI6MjEwMjM4MTEwMX0.Wv1hEaaGfmydRPrhNUThZAo85nF9peTi3arNn619AW8';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'fredichfoundou09@gmail.com',
      password: 'Sentinelle066328874//'
    })
  });

  const text = await res.text();
  console.log("Status:", res.status, "Body:", text);
}

testFetch();
