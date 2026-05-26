require('dotenv').config();

async function test() {
  try {
    console.log('Logging in as sujith.blower...');
    
    let token = '';
    // Try login with PIN/Password using identity/credential
    const loginRes = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: 'sujith.blower',
        credential: 'Password123!'
      })
    });
    
    if (loginRes.ok) {
      const data = await loginRes.json();
      token = data.access_token;
    } else {
      const errText = await loginRes.text();
      console.error('Login failed:', loginRes.status, errText);
      return;
    }

    console.log('Logged in successfully. Token obtained.');

    console.log('Fetching raw materials...');
    const materialsRes = await fetch('http://localhost:4000/api/master-data/raw-materials', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log('Materials Response Status:', materialsRes.status);
    const materialsData = await materialsRes.json();
    console.log('Materials returned:', materialsData);

  } catch (error) {
    console.error('Error in test:', error);
  }
}

test();
