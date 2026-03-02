import fs from 'node:fs';
import path from 'node:path';

const distPath = path.resolve(process.cwd(), 'dist');
const limitBytes = Number(process.env.BUNDLE_SIZE_LIMIT_BYTES ?? 3145728); // 3MB default

if (!fs.existsSync(distPath)) {
  console.error(`❌ Build output not found at ${distPath}`);
  console.error('Run `npm run build` before bundle-size gate.');
  process.exit(1);
}

const calculateDirectorySize = (directoryPath) => {
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });

  return entries.reduce((total, entry) => {
    const fullPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      return total + calculateDirectorySize(fullPath);
    }

    if (entry.isFile()) {
      return total + fs.statSync(fullPath).size;
    }

    return total;
  }, 0);
};

const totalBytes = calculateDirectorySize(distPath);
const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
const limitMb = (limitBytes / (1024 * 1024)).toFixed(2);

if (totalBytes > limitBytes) {
  console.error(`❌ Bundle size gate failed: ${totalMb}MB > ${limitMb}MB limit`);
  process.exit(1);
}

console.log(`✅ Bundle size gate passed: ${totalMb}MB <= ${limitMb}MB limit`);
