import { extractPDFText } from '../src/ingestion/pdf-extractor.js';

async function main() {
  const result = await extractPDFText('apps/backend/data/raw/CS/2023_CS.pdf');
  const lines = result.text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().includes('carry')) {
      console.log(`Line ${i}: ${lines[i]}`);
    }
  }
}

main().catch(console.error);