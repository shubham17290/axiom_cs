import { PDFParse } from 'pdf-parse';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Go up from apps/backend/scripts to project root
const projectRoot = 'D:/005 Projects/gate cs and it pyq acer';

const pdfPath = path.join(projectRoot, 'apps', 'backend', 'data', 'raw', 'CS', '2026_CS1.pdf');
const dataBuffer = fs.readFileSync(pdfPath);
const parser = new PDFParse({ data: dataBuffer });
await parser.load();
const data = await parser.getText();
console.log('Text length:', data.text.length);
console.log('--- FIRST 5000 CHARS ---');
console.log(data.text.substring(0, 5000));