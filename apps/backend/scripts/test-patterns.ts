import { extractPDFText } from '../src/ingestion/pdf-extractor.js';

async function main() {
  const result = await extractPDFText('apps/backend/data/raw/CS/2023_CS.pdf');
  const lines = result.text.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.toLowerCase().includes('carry')) {
      console.log(`Line ${i}: "${trimmed}"`);
      console.log(`  Char codes: ${[...trimmed].map(c => c.charCodeAt(0)).join(', ')}`);
      
      // Test patterns
      const pattern1 = /Q\.\s*(\d+)\s*[–-]\s*Q\.\s*(\d+)\s+Carry\s+(one|two)\s+marks?(?:\s+[Ee]ach)?/i;
      const pattern2 = /[–-]\s*Q\.\s*(\d+)\s+Carry\s+(one|two)\s+marks?(?:\s+[Ee]ach)?/i;
      
      console.log(`  Pattern 1 match: ${pattern1.test(trimmed)}`);
      console.log(`  Pattern 2 match: ${pattern2.test(trimmed)}`);
    }
  }
}

main().catch(console.error);