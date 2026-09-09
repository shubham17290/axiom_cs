#!/usr/bin/env node

import { runPilotPipeline, printPipelineSummary } from '../src/ingestion/pipeline.js';

async function main() {
  console.log('=== GATE PYQ PDF Ingestion Pipeline ===');
  console.log('Phase 12F.2 - Pilot Run\n');

  try {
    const result = await runPilotPipeline();
    printPipelineSummary(result);

    if (result.report) {
      console.log('\n========== HUMAN REPORT ==========\n');
      console.log(result.report);
    }

    process.exit(0);
  } catch (error) {
    console.error('Pipeline failed:', error);
    process.exit(1);
  }
}

main();