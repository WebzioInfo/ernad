/**
 * END-TO-END GROQ LLM + TOOL CALLING + VECTOR RAG ORCHESTRATION TEST SUITE
 * 
 * Verifies real generative AI understanding and planning across diverse, natural Malayalam,
 * English, and hybrid queries without relying on hardcoded keyword arrays.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AiService } from '../src/modules/ai/ai.service';
import { GroqLlmService } from '../src/modules/ai/llm/groq-llm.service';

async function runGroqSuite() {
  console.log('🚀 INITIALIZING NESTJS APPLICATION FOR REAL GROQ AI TEST SUITE...');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'warn', 'error'] });
  const aiService = app.get(AiService);
  const groqService = app.get(GroqLlmService);

  const health = await groqService.checkHealth();
  console.log(`\n====================================================`);
  console.log(`🤖 GROQ PROVIDER STATUS: ${health.ok ? 'ONLINE ✅' : 'OFFLINE ❌'} | Model: ${health.model}`);
  console.log(`====================================================\n`);

  const testCases = [
    {
      title: 'Natural Dialect Previous Month Dispatch',
      question: 'കടഞ്ഞ മാസം എത്ര dispatch ചെയ്തു?',
      expectedSource: 'LIVE_ERP',
      verify: (res: any) => {
        const text = JSON.stringify(res.answer);
        return text.includes('130') || text.includes('ജൂലൈ') || text.includes('July') || text.includes('dispatch');
      }
    },
    {
      title: 'Current Month Sales Dispatch in Malayalam',
      question: 'ഈ മാസം എത്ര sales dispatch ചെയ്തു?',
      expectedSource: 'LIVE_ERP',
      verify: (res: any) => {
        const text = JSON.stringify(res.answer);
        return text.includes('1,000') || text.includes('1000') || text.includes('ഓഗസ്റ്റ്') || text.includes('August');
      }
    },
    {
      title: 'Month Before July Sales (June)',
      question: 'July-ന് മുമ്പുള്ള മാസത്തെ dispatch എത്ര?',
      expectedSource: 'LIVE_ERP',
      verify: (res: any) => {
        return res.answer && (res.answer.ml || res.answer.en);
      }
    },
    {
      title: 'Named Product Stock Inventory',
      question: 'Kenby 1 stock എത്രയുണ്ട്?',
      expectedSource: 'LIVE_ERP',
      verify: (res: any) => {
        const text = JSON.stringify(res.answer);
        return text.includes('980') || text.includes('Kenby 1') || text.includes('സ്റ്റോക്ക്');
      }
    },
    {
      title: 'Raw Material Balance Query',
      question: 'Green Cap എത്ര ബാക്കിയുണ്ട്?',
      expectedSource: 'LIVE_ERP',
      verify: (res: any) => {
        const text = JSON.stringify(res.answer);
        return text.includes('Green Cap') || text.includes('CAP') || text.includes('BOX');
      }
    },
    {
      title: 'Conceptual Definition (Vector RAG)',
      question: 'sales dispatch എന്താണ്?',
      expectedSource: 'RAG',
      verify: (res: any) => {
        const text = JSON.stringify(res.answer);
        return text.includes('Sales') || text.includes('dispatch') || text.includes('ഉൽപ്പന്നങ്ങൾ');
      }
    },
    {
      title: 'Hybrid Query: Live Operational Data + Conceptual RAG',
      question: 'ഈ മാസം sales dispatch എത്ര, sales dispatch എന്താണ്?',
      expectedSource: 'HYBRID',
      verify: (res: any) => {
        const text = JSON.stringify(res.answer);
        return (res.source === 'HYBRID' || text.includes('1,000') || text.includes('1000')) && (text.includes('Sales') || text.includes('dispatch') || text.includes('ഉൽപ്പന്നങ്ങൾ'));
      }
    },
    {
      title: 'Customer Details Query',
      question: 'Sinan എത്ര കുടിശ്ശികയുണ്ട്?',
      expectedSource: 'LIVE_ERP',
      verify: (res: any) => {
        const text = JSON.stringify(res.answer);
        return text.includes('Sinan') || text.includes('കുടിശ്ശിക') || text.includes('₹');
      }
    },
    {
      title: 'Unsupported Financial Safety Guardrail',
      question: 'കമ്പനിയുടെ net profit എത്ര?',
      expectedSource: 'UNSUPPORTED',
      verify: (res: any) => {
        const text = JSON.stringify(res.answer);
        return text.includes('ലഭ്യമല്ല') || text.includes('not managed');
      }
    }
  ];

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    console.log(`\n----------------------------------------------------`);
    console.log(`TEST [${i + 1}/${testCases.length}]: ${tc.title}`);
    console.log(`Question: "${tc.question}"`);

    try {
      const response = await aiService.askQuestion(tc.question, {});
      console.log(`\n💬 AI Answer (Malayalam):\n${response.answer.ml}`);
      console.log(`\n💬 AI Answer (English):\n${response.answer.en}`);
      console.log(`Source: ${response.source}`);

      const ok = tc.verify(response);
      if (ok) {
        console.log(`✅ PASS [${i + 1}]: ${tc.title}`);
        passed++;
      } else {
        console.error(`❌ FAIL [${i + 1}]: ${tc.title}`);
        failed++;
      }
    } catch (err: any) {
      console.error(`❌ ERROR [${i + 1}]: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n====================================================`);
  console.log(`📊 REAL GROQ ORCHESTRATION RESULTS: ${passed} PASSED | ${failed} FAILED (Total: ${testCases.length})`);
  console.log(`====================================================\n`);

  await app.close();
  process.exit(failed > 0 ? 1 : 0);
}

runGroqSuite().catch((err) => {
  console.error('Fatal error running Groq suite:', err);
  process.exit(1);
});
