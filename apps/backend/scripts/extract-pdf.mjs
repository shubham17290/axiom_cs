import { PDFParse } from 'pdf-parse';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const pdfPath = path.join(projectRoot, 'data', 'raw', 'CS', '2023_CS.pdf');
const dataBuffer = fs.readFileSync(pdfPath);
const parser = new PDFParse({ data: dataBuffer });
await parser.load();
const data = await parser.getText();

// Search for answer key
const answerKeyIndex = data.text.toLowerCase().indexOf('answer key');
if (answerKeyIndex !== -1) {
  console.log('Found answer key at:', answerKeyIndex);
  console.log(data.text.substring(answerKeyIndex, answerKeyIndex + 5000));
} else {
  console.log('No "answer key" found');
  // Search for 'answer' near the end
  const endText = data.text.substring(data.text.length - 10000);
  const answerIndex = endText.toLowerCase().indexOf('answer');
  if (answerIndex !== -1) {
    console.log('Found "answer" near end at:', answerIndex);
    console.log(endText.substring(answerIndex, answerIndex + 3000));
  } else {
    console.log('No "answer" found near end either');
  }
}