const fs = require('fs');
const readline = require('readline');

async function extract() {
  const fileStream = fs.createReadStream('C:/Users/siinaan/.gemini/antigravity-ide/brain/a37f747c-48a5-4e53-a113-70de45ac674b/.system_generated/logs/transcript.jsonl');
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let lastUser = null;
  for await (const line of rl) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.type === 'USER_INPUT') {
        lastUser = parsed.content;
      }
    } catch(e) {}
  }
  console.log(lastUser);
}

extract();
