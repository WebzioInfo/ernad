async function run() {
  try {
    console.log('Logging in as pranesh.manager...');
    const loginRes = await fetch('http://127.0.0.1:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: 'pranesh.manager',
        credential: 'adminadmin',
        type: 'PASSWORD'
      })
    });
    
    if (!loginRes.ok) {
      console.error('Login failed:', loginRes.status, await loginRes.text());
      return;
    }
    
    const loginData = await loginRes.json() as any;
    const token = loginData.access_token;
    console.log('Token acquired:', token);
    
    const endpoints = [
      'api/users?role=OPERATOR&isActive=true',
      'api/notifications/unread',
      'api/analytics/factory/live',
      'api/analytics/factory/efficiency',
      'api/users/audit-logs'
    ];

    for (const ep of endpoints) {
      console.log(`\nFetching ${ep}...`);
      const res = await fetch(`http://127.0.0.1:4000/${ep}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      console.log('Response Status:', res.status);
      const text = await res.text();
      console.log('Response Body:', text.slice(0, 200));
    }
  } catch (err: any) {
    console.error('Failed:', err);
  }
}

run();

