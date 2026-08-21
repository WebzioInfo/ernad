import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function testQueries() {
  const queries = [
    'July-ന് മുമ്പുള്ള മാസത്തെ dispatch എത്ര?',
    'ഈ മാസം sales dispatch എത്ര, sales dispatch എന്താണ്?',
    'Sinan വിവരങ്ങൾ',
    'കമ്പനിയുടെ net profit എത്ര?'
  ];

  for (const q of queries) {
    console.log(`\n========================================`);
    console.log(`QUERY: "${q}"`);
    const prompt = `Current Date: 2026-08-20 (Thursday)
Timezone: Asia/Kolkata

Available Tools:
- get_sales_summary({ period: "this_month" | "last_month" | "today" | "yesterday" | "specific_month", year?: number, month?: number, product?: string })
- get_customer_profile({ customer: string })
- get_customer_balance({ customer: string })
- get_product_stock({ product?: string })
- get_raw_material_stock({ material: string })
- get_knowledge({ topic: string })

User asked: "${q}"

Output strict JSON:
{
  "thought": string,
  "requiresLiveData": boolean,
  "requiresKnowledge": boolean,
  "tasks": [
    {
      "tool": string,
      "parameters": Record<string, any>
    }
  ],
  "isUnsupportedFinancial": boolean,
  "clarificationNeeded": boolean,
  "clarificationMessage": { "ml": string, "en": string } | null
}`;

    const res = await groq.chat.completions.create({
      model: 'groq/compound',
      messages: [
        { role: 'system', content: 'You are an expert ERP semantic understanding planner. Always respond with strict JSON.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.0,
    });

    console.log(res.choices[0]?.message?.content);
  }
}

testQueries().catch(console.error);
