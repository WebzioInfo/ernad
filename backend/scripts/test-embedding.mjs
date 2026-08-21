import { pipeline } from '@huggingface/transformers';

const MODEL = 'Xenova/multilingual-e5-small';

console.log('Loading embedding model...');
console.log(`Model: ${MODEL}`);

const extractor = await pipeline(
    'feature-extraction',
    MODEL
);

console.log('Embedding model loaded.');

const texts = [
    'query: Sales dispatch എന്താണ്?',
    'passage: Sales Dispatch means finished products dispatched to a customer.',
    'passage: Production represents finished goods produced by the factory.'
];

for (const text of texts) {
    const output = await extractor(text, {
        pooling: 'mean',
        normalize: true,
    });

    const embedding = Array.from(output.data);

    console.log('\n--------------------------------');
    console.log('Text:', text);
    console.log('Dimensions:', embedding.length);
    console.log('First 10 values:', embedding.slice(0, 10));
}