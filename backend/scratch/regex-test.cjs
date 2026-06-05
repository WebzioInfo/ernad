const pattern = new RegExp(`\\\\(Log #123\\\\)`);
console.log(pattern.source);
console.log(pattern.test('Bags used in Blowing Station (Log #123)'));
