import 'dotenv/config';
import postgres from 'postgres';
import { pipeline } from '@huggingface/transformers';

const MODEL = 'Xenova/multilingual-e5-small';

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing from environment variables.');
}

const connectionString = process.env.DATABASE_URL;

console.log('==========================================');
console.log('       KENBY RAG KNOWLEDGE SEEDER');
console.log('==========================================');
console.log();

console.log('Loading embedding model...');
console.log(`Model: ${MODEL}`);

const extractor = await pipeline('feature-extraction', MODEL);

console.log('Embedding model loaded.');
console.log();

const sql = postgres(connectionString, {
    prepare: false,
    ssl:
        connectionString.includes('sslmode=require') ||
            connectionString.includes('pooler.supabase.com') ||
            connectionString.includes('supabase.co')
            ? { rejectUnauthorized: false }
            : undefined,
    max: 1,
});

const documents = [
    {
        title: 'Sales',
        category: 'business',
        language: 'ml-en',
        content: `
Sales means products that were dispatched or sold to customers.

In Kenby ERP, Sales Dispatch represents finished products sent out to customers.
Sales quantity is recorded based on the sales transaction.
Sales information does not include customer payment information because Kenby currently does not manage payment tracking.

മലയാളത്തിൽ:
Sales എന്നത് customer-ന് ഉൽപ്പന്നങ്ങൾ dispatch ചെയ്തതിനെ സൂചിപ്പിക്കുന്നു.
Kenby-യിൽ Sales Dispatch ആയി രേഖപ്പെടുത്തിയ quantity ആണ് sales ആയി കണക്കാക്കുന്നത്.
Kenby നിലവിൽ customer payment tracking അല്ലെങ്കിൽ payment management കൈകാര്യം ചെയ്യുന്നില്ല.
`,
    },

    {
        title: 'Production',
        category: 'production',
        language: 'ml-en',
        content: `
Production means finished goods produced by the factory.

Kenby production records contain production output, production date, batch information, station information and related production details.

മലയാളത്തിൽ:
Production എന്നത് factory-ൽ നിർമ്മിച്ച finished goods ആണ്.
Production records-ൽ production quantity, date, batch, station തുടങ്ങിയ വിവരങ്ങൾ ഉൾപ്പെടുന്നു.
`,
    },

    {
        title: 'Finished Goods Stock',
        category: 'inventory',
        language: 'ml-en',
        content: `
Finished goods stock means the quantity of finished products currently available for dispatch.

Stock is affected by production and dispatch transactions.
Production can increase finished goods stock.
Sales dispatch decreases available finished goods stock.

മലയാളത്തിൽ:
Finished goods stock എന്നത് ഇപ്പോൾ dispatch ചെയ്യാൻ ലഭ്യമായ finished products-ന്റെ quantity ആണ്.
Production stock കൂട്ടും.
Sales Dispatch stock കുറയ്ക്കും.
`,
    },

    {
        title: 'Sales Return',
        category: 'sales',
        language: 'ml-en',
        content: `
Sales Return means products that were previously dispatched or sold and then returned.

A sales return is a separate transaction type from Sales Dispatch.
Return quantities should not be incorrectly reported as new sales.

മലയാളത്തിൽ:
Sales Return എന്നത് മുമ്പ് customer-ന് dispatch ചെയ്ത products തിരികെ വന്നതാണ്.
Sales Return ഒരു separate transaction ആണ്.
Return quantity പുതിയ sales ആയി കണക്കാക്കരുത്.
`,
    },

    {
        title: 'Damage',
        category: 'inventory',
        language: 'ml-en',
        content: `
Damage means finished goods that are recorded as damaged and are not considered normal available stock.

Damage quantity should be reported separately from sales, production and sales returns.

മലയാളത്തിൽ:
Damage എന്നത് damaged goods ആണ്.
Damage quantity sales അല്ല.
Production അല്ല.
Sales Return അല്ല.
അത് പ്രത്യേകം report ചെയ്യേണ്ടതാണ്.
`,
    },
];

async function createEmbedding(text) {
    const output = await extractor(`passage: ${text}`, {
        pooling: 'mean',
        normalize: true,
    });

    return Array.from(output.data);
}

console.log(`Preparing ${documents.length} knowledge documents...`);
console.log();

for (const document of documents) {
    console.log(`Embedding: ${document.title}`);

    const embedding = await createEmbedding(document.content);

    if (embedding.length !== 384) {
        throw new Error(
            `Invalid embedding dimensions for "${document.title}": ${embedding.length}`
        );
    }

    await sql`
    insert into public.kenby_ai_documents (
      title,
      content,
      category,
      language,
      metadata,
      embedding
    )
    values (
      ${document.title},
      ${document.content.trim()},
      ${document.category},
      ${document.language},
      ${JSON.stringify({
        source: 'kenby-rag-seed',
        version: 1,
    })}::jsonb,
      ${JSON.stringify(embedding)}::extensions.vector
    )
  `;

    console.log(`✓ Stored: ${document.title}`);
}

console.log();
console.log('==========================================');
console.log('Knowledge documents inserted successfully.');
console.log('==========================================');
console.log();


// --------------------------------------------------
// TEST RETRIEVAL
// --------------------------------------------------

const testQuestion = 'Sales dispatch എന്താണ്?';

console.log('Testing RAG retrieval...');
console.log(`Question: ${testQuestion}`);
console.log();

const queryOutput = await extractor(`query: ${testQuestion}`, {
    pooling: 'mean',
    normalize: true,
});

const queryEmbedding = Array.from(queryOutput.data);

const results = await sql`
  select *
  from public.match_kenby_documents(
    ${JSON.stringify(queryEmbedding)}::extensions.vector,
    0.50,
    5
  )
`;

console.log('Retrieved documents:');
console.log();

for (const [index, result] of results.entries()) {
    console.log(`${index + 1}. ${result.title}`);
    console.log(`   Category: ${result.category}`);
    console.log(`   Similarity: ${Number(result.similarity).toFixed(4)}`);
    console.log();
}

await sql.end();

console.log('RAG test completed.'); 