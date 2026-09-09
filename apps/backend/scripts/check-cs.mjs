import { extractPDFText } from '../src/ingestion/pdf-extractor.js';

const result = await extractPDFText('apps/backend/data/raw/CS/2023_CS.pdf');
const idx = result.text.indexOf('Q.11');
if (idx !== -1) {
  console.log(result.text.substring(idx, idx + 3000));
}