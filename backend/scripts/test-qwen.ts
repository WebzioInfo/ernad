import Groq from 'groq-sdk';
import dotenv from 'dotenv';
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function testQwen() {
  const query = 'Sinan എത്ര കുടിശ്ശികയുണ്ട്?';
  const prompt = `Current Date: 2026-08-20, Timezone: Asia/Kolkata
Tools:
- get_sales_summary({ period: string, year?: number, month?: number })
- get_customer_profile({ customer: string })
- get_customer_balance({ customer: string })
- get_product_stock({ product?: string })
- get_raw_material_stock({ material: string })
- get_knowledge({ topic: string })

User asked: "${query}"

Return JSON:
{
  "thought": string,
  "requiresLiveData": boolean,
  "requiresKnowledge": boolean,
  "tasks": [{"tool": string, "parameters": Record<string, any>}],
  "isUnsupportedFinancial": boolean,
  "clarificationNeeded": boolean,
  "clarificationMessage": {"ml": string, "en": string} | null
}`;

  const res = await groq.chat.completions.create({
    model: 'qwen/qwen3.6-27b',
    messages: [
      { role: 'system', content: 'You are an ERP assistant. Always output valid JSON.' },
      { role: 'user', content: prompt }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.0,
  });

  console.log('QWEN RESULT:', res.choices[0]?.message?.content);
}

testQwen().catch(console.error);
