const fs = require('fs');
const file = 'c:/Users/siinaan/Desktop/ernad/frontend/src/utils/pdfExport.ts';
let code = fs.readFileSync(file, 'utf-8');
code = code.replace(/\\\`/g, '`');
code = code.replace(/\\\$/g, '$');
fs.writeFileSync(file, code);
console.log('Fixed escape characters in pdfExport.ts');
