import fs from 'node:fs';
import path from 'node:path';

const summaryPath = path.resolve(process.cwd(), 'coverage/coverage-summary.json');
const threshold = Number(process.env.COVERAGE_THRESHOLD ?? 60);

if (!fs.existsSync(summaryPath)) {
  console.error(`❌ Coverage summary not found at ${summaryPath}`);
  console.error('Run `npm run test:coverage` before coverage gate.');
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const total = summary?.total;

if (!total) {
  console.error('❌ Invalid coverage summary format: missing `total` section.');
  process.exit(1);
}

const metrics = ['lines', 'statements', 'functions', 'branches'];
let failed = false;

for (const metric of metrics) {
  const pct = Number(total?.[metric]?.pct ?? 0);
  if (pct < threshold) {
    failed = true;
    console.error(`❌ Coverage gate failed for ${metric}: ${pct}% < ${threshold}%`);
  } else {
    console.log(`✅ Coverage ${metric}: ${pct}% >= ${threshold}%`);
  }
}

if (failed) {
  process.exit(1);
}

console.log(`🎉 Coverage gate passed at ${threshold}% threshold.`);
