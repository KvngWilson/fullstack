import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const summaryPath = path.resolve(cwd, 'coverage/coverage-summary.json');
const finalPath = path.resolve(cwd, 'coverage/coverage-final.json');

const metricThresholds = {
  lines: Number(process.env.COVERAGE_LINES_THRESHOLD ?? process.env.COVERAGE_THRESHOLD ?? 60),
  statements: Number(process.env.COVERAGE_STATEMENTS_THRESHOLD ?? process.env.COVERAGE_THRESHOLD ?? 60),
  functions: Number(process.env.COVERAGE_FUNCTIONS_THRESHOLD ?? process.env.COVERAGE_THRESHOLD ?? 60),
  branches: Number(process.env.COVERAGE_BRANCHES_THRESHOLD ?? process.env.COVERAGE_THRESHOLD ?? 60),
};

const criticalThreshold = Number(process.env.CRITICAL_COVERAGE_THRESHOLD ?? 0);
const criticalFiles = (process.env.CRITICAL_COVERAGE_FILES || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

const getPct = (covered, total) => {
  if (!Number.isFinite(total) || total <= 0) {
    return 0;
  }
  return Number(((covered / total) * 100).toFixed(2));
};

const countCovered = (entries = {}) => {
  return Object.values(entries).reduce((acc, hits) => {
    return acc + (Number(hits) > 0 ? 1 : 0);
  }, 0);
};

const computeSummaryFromFinal = (coverageFinal) => {
  const totals = {
    lines: { covered: 0, total: 0 },
    statements: { covered: 0, total: 0 },
    functions: { covered: 0, total: 0 },
    branches: { covered: 0, total: 0 },
  };

  for (const fileData of Object.values(coverageFinal)) {
    const statementsTotal = Object.keys(fileData?.s || {}).length;
    const statementsCovered = countCovered(fileData?.s || {});

    const functionsTotal = Object.keys(fileData?.f || {}).length;
    const functionsCovered = countCovered(fileData?.f || {});

    const branchesArray = Object.values(fileData?.b || {});
    const branchesTotal = branchesArray.reduce((sum, hits) => sum + hits.length, 0);
    const branchesCovered = branchesArray.reduce((sum, hits) => {
      return sum + hits.filter((hit) => Number(hit) > 0).length;
    }, 0);

    const linesMap = fileData?.statementMap || {};
    const uniqueLines = new Set(
      Object.values(linesMap)
        .map((location) => location?.start?.line)
        .filter((line) => Number.isInteger(line)),
    );
    const linesTotal = uniqueLines.size;

    const linesCoveredSet = new Set();
    for (const [statementId, location] of Object.entries(linesMap)) {
      if (Number(fileData?.s?.[statementId]) > 0 && Number.isInteger(location?.start?.line)) {
        linesCoveredSet.add(location.start.line);
      }
    }

    totals.statements.total += statementsTotal;
    totals.statements.covered += statementsCovered;
    totals.functions.total += functionsTotal;
    totals.functions.covered += functionsCovered;
    totals.branches.total += branchesTotal;
    totals.branches.covered += branchesCovered;
    totals.lines.total += linesTotal;
    totals.lines.covered += linesCoveredSet.size;
  }

  return {
    total: {
      lines: { pct: getPct(totals.lines.covered, totals.lines.total) },
      statements: { pct: getPct(totals.statements.covered, totals.statements.total) },
      functions: { pct: getPct(totals.functions.covered, totals.functions.total) },
      branches: { pct: getPct(totals.branches.covered, totals.branches.total) },
    },
  };
};

if (!fs.existsSync(summaryPath) && !fs.existsSync(finalPath)) {
  console.error(`[FAIL] Coverage data not found at ${summaryPath} or ${finalPath}`);
  console.error('Run `npm run test:coverage` before coverage gate.');
  process.exit(1);
}

const summary = fs.existsSync(summaryPath)
  ? JSON.parse(fs.readFileSync(summaryPath, 'utf8'))
  : computeSummaryFromFinal(JSON.parse(fs.readFileSync(finalPath, 'utf8')));
const total = summary?.total;

if (!total) {
  console.error('[FAIL] Invalid coverage summary format: missing `total` section.');
  process.exit(1);
}

const metrics = ['lines', 'statements', 'functions', 'branches'];
let failed = false;

for (const metric of metrics) {
  const pct = Number(total?.[metric]?.pct ?? 0);
  const threshold = metricThresholds[metric];

  if (!Number.isFinite(threshold)) {
    console.error(`[FAIL] Invalid threshold for ${metric}: ${threshold}`);
    failed = true;
    continue;
  }

  if (pct < threshold) {
    failed = true;
    console.error(`[FAIL] Coverage gate failed for ${metric}: ${pct}% < ${threshold}%`);
  } else {
    console.log(`[PASS] Coverage ${metric}: ${pct}% >= ${threshold}%`);
  }
}

if (criticalFiles.length > 0 && criticalThreshold > 0) {
  const coverageFinal = fs.existsSync(finalPath)
    ? JSON.parse(fs.readFileSync(finalPath, 'utf8'))
    : null;

  if (!coverageFinal) {
    console.error('[FAIL] Critical coverage gate requires coverage-final.json');
    failed = true;
  } else {
    for (const relativeFile of criticalFiles) {
      const normalizedSuffix = relativeFile.replace(/\\/g, '/');
      const matchedPath = Object.keys(coverageFinal).find((filePath) => {
        return filePath.replace(/\\/g, '/').endsWith(normalizedSuffix);
      });

      if (!matchedPath) {
        failed = true;
        console.error(`[FAIL] Critical coverage file not found in report: ${relativeFile}`);
        continue;
      }

      const fileData = coverageFinal[matchedPath];
      const statementHits = fileData?.s || {};
      const statementTotal = Object.keys(statementHits).length;
      const statementCovered = countCovered(statementHits);
      const statementPct = getPct(statementCovered, statementTotal);

      if (statementPct < criticalThreshold) {
        failed = true;
        console.error(
          `[FAIL] Critical coverage failed for ${relativeFile}: ${statementPct}% < ${criticalThreshold}%`,
        );
      } else {
        console.log(
          `[PASS] Critical coverage ${relativeFile}: ${statementPct}% >= ${criticalThreshold}%`,
        );
      }
    }
  }
}

if (failed) {
  process.exit(1);
}

const thresholdSummary = metrics
  .map((metric) => `${metric}=${metricThresholds[metric]}%`)
  .join(', ');

console.log(`[PASS] Coverage gate passed (${thresholdSummary}).`);
