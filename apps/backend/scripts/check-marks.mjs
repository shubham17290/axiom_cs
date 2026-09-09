import { extractPDFText } from '../src/ingestion/pdf-extractor.js';

const result = await extractPDFText('apps/backend/data/raw/CS/2023_CS.pdf');
const pattern = /Q\.\s*(\d+)\s*[–-]\s*Q\.\s*(\d+)\s+Carry\s+(one|two)\s+marks?/gi;
let match;
while ((match = pattern.exec(result.text)) !== null) {
  console.log('Match:', match[0]);
  console.log('  Start:', match[1], 'End:', match[2], 'Marks:', match[3]);
}