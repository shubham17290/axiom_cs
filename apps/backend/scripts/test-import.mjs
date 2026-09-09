import { listRawPDFFiles, PROJECT_ROOT } from '../src/ingestion/pdf-extractor.js';

console.log('PROJECT_ROOT:', PROJECT_ROOT);
const files = listRawPDFFiles();
console.log('Files:', files);