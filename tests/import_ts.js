/**
 * Safe TypeScript Module Importer for Soko Node Tests
 *
 * Automatically delegates to native TypeScript loader (Node 23+) if supported,
 * or dynamically transpiles via typescript compiler when running on Node 20 / 22.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

let cacheDir = null;
const compiledFiles = new Map();

function transpileTsFile(filePath) {
  const absPath = path.resolve(filePath);
  if (compiledFiles.has(absPath)) {
    return compiledFiles.get(absPath);
  }

  if (!cacheDir) {
    cacheDir = path.join(os.tmpdir(), `soko-ts-cache-${process.pid}`);
    fs.mkdirSync(cacheDir, { recursive: true });
    process.on('exit', () => {
      try {
        fs.rmSync(cacheDir, { recursive: true, force: true });
      } catch (_) {}
    });
  }

  let ts;
  try {
    ts = require(path.resolve(__dirname, '../apps/desktop/node_modules/typescript'));
  } catch (_) {
    ts = require('typescript');
  }

  const code = fs.readFileSync(absPath, 'utf8');
  let transpiled = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  const outPath = path.join(cacheDir, `${path.basename(absPath, '.ts')}-${compiledFiles.size}.mjs`);
  compiledFiles.set(absPath, outPath);

  // Recursively transpile and rewrite relative .ts imports
  transpiled = transpiled.replace(/from\s+([\"\'])(\.\.?[^\"\']*?)\.ts\1/g, (match, quote, relPath) => {
    const targetTs = path.resolve(path.dirname(absPath), relPath + '.ts');
    const targetMjs = transpileTsFile(targetTs);
    return `from ${quote}${targetMjs}${quote}`;
  });

  fs.writeFileSync(outPath, transpiled);
  return outPath;
}

async function importTs(filePath, callerDir = process.cwd()) {
  const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(callerDir, filePath);
  try {
    return await import(absPath);
  } catch (err) {
    if (err && (err.code === 'ERR_UNKNOWN_FILE_EXTENSION' || (err.message && err.message.includes('Unknown file extension')))) {
      const compiledPath = transpileTsFile(absPath);
      return await import(compiledPath);
    }
    throw err;
  }
}

module.exports = { importTs };
