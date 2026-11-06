/**
 * @file qrGenerator.js
 * Pure JavaScript ISO/IEC 18004 QR Code matrix generator and SVG renderer.
 * Zero external dependencies. Zero native C/canvas requirements.
 */

// Galois Field GF(256) tables with primitive polynomial 0x11d (285)
const EXP_TABLE = new Uint8Array(512);
const LOG_TABLE = new Uint8Array(256);

(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = x;
    LOG_TABLE[x] = i;
    x <<= 1;
    if (x & 0x100) {
      x ^= 0x11d;
    }
  }
  for (let i = 255; i < 512; i++) {
    EXP_TABLE[i] = EXP_TABLE[i - 255];
  }
})();

function gMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP_TABLE[LOG_TABLE[a] + LOG_TABLE[b]];
}

// Generator polynomials for Reed-Solomon codes
function rsGeneratorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    const root = EXP_TABLE[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gMul(poly[j], root);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

// Polynomial division for Reed-Solomon error correction
function rsCalculateCodewords(data, ecCount) {
  const gen = rsGeneratorPoly(ecCount);
  const result = new Array(ecCount).fill(0);

  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ result[0];
    result.shift();
    result.push(0);
    for (let j = 0; j < ecCount; j++) {
      result[j] ^= gMul(gen[j], factor);
    }
  }
  return result;
}

// Capacity table: [dataCapacityBytes, ecCodewordsPerBlock, numBlocks] for Level M
const VERSION_CAPACITY_M = [
  null,
  { data: 16, ec: 10, blocks: 1 },  // V1: 21x21
  { data: 28, ec: 16, blocks: 1 },  // V2: 25x25
  { data: 44, ec: 26, blocks: 1 },  // V3: 29x29
  { data: 64, ec: 18, blocks: 2 },  // V4: 33x33
  { data: 86, ec: 24, blocks: 2 },  // V5: 37x37
  { data: 108, ec: 16, blocks: 4 }, // V6: 41x41
  { data: 124, ec: 18, blocks: 4 }, // V7: 45x45
  { data: 154, ec: 22, blocks: 4 }, // V8: 49x49
  { data: 182, ec: 22, blocks: 5 }, // V9: 53x53
  { data: 216, ec: 26, blocks: 5 }, // V10: 57x57
  { data: 254, ec: 30, blocks: 5 }, // V11: 61x61
  { data: 290, ec: 22, blocks: 8 }, // V12: 65x65
];

// Capacity table for Level L (Higher capacity, 7% recovery)
const VERSION_CAPACITY_L = [
  null,
  { data: 19, ec: 7, blocks: 1 },
  { data: 34, ec: 10, blocks: 1 },
  { data: 55, ec: 15, blocks: 1 },
  { data: 80, ec: 20, blocks: 1 },
  { data: 108, ec: 26, blocks: 1 },
  { data: 136, ec: 18, blocks: 2 },
  { data: 156, ec: 20, blocks: 2 },
  { data: 194, ec: 24, blocks: 2 },
  { data: 232, ec: 30, blocks: 2 },
  { data: 274, ec: 18, blocks: 4 },
  { data: 324, ec: 20, blocks: 4 },
  { data: 370, ec: 24, blocks: 4 },
];

const ALIGNMENT_PATTERN_POS = [
  [],
  [],                          // V1: none
  [6, 18],                     // V2
  [6, 22],                     // V3
  [6, 26],                     // V4
  [6, 30],                     // V5
  [6, 34],                     // V6
  [6, 22, 38],                 // V7
  [6, 24, 42],                 // V8
  [6, 26, 46],                 // V9
  [6, 28, 50],                 // V10
  [6, 30, 54],                 // V11
  [6, 32, 58],                 // V12
];

const FORMAT_INFO = {
  L: [0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976],
  M: [0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0],
  Q: [0x355f, 0x3068, 0x3f31, 0x3a06, 0x24b4, 0x2183, 0x2eda, 0x2bed],
  H: [0x1689, 0x13be, 0x1ce7, 0x19d0, 0x0762, 0x0255, 0x0d0c, 0x083b],
};

function encodeBitstream(text, version, capacity) {
  const rawBytes = Buffer.from(text, 'utf8');
  const totalDataBytes = capacity.data;

  let bits = '0100'; // 4 bits byte mode
  const countBits = version < 10 ? 8 : 16;
  bits += rawBytes.length.toString(2).padStart(countBits, '0');

  for (let i = 0; i < rawBytes.length; i++) {
    bits += rawBytes[i].toString(2).padStart(8, '0');
  }

  const maxBits = totalDataBytes * 8;
  const terminatorLen = Math.min(4, maxBits - bits.length);
  bits += '0'.repeat(terminatorLen);

  const remainder = bits.length % 8;
  if (remainder !== 0) {
    bits += '0'.repeat(8 - remainder);
  }

  const padPatterns = ['11101100', '00010001'];
  let padIdx = 0;
  while (bits.length < maxBits) {
    bits += padPatterns[padIdx % 2];
    padIdx++;
  }

  const dataBytes = new Uint8Array(totalDataBytes);
  for (let i = 0; i < totalDataBytes; i++) {
    dataBytes[i] = parseInt(bits.slice(i * 8, (i + 1) * 8), 2);
  }

  return dataBytes;
}

function buildCodewords(dataBytes, capacity) {
  const numBlocks = capacity.blocks;
  const ecPerBlock = capacity.ec;
  const dataLen = dataBytes.length;

  const baseBlockLen = Math.floor(dataLen / numBlocks);
  const extraBlocks = dataLen % numBlocks;

  const dataBlocks = [];
  const ecBlocks = [];

  let offset = 0;
  for (let b = 0; b < numBlocks; b++) {
    const blockLen = baseBlockLen + (b >= numBlocks - extraBlocks ? 1 : 0);
    const blockData = dataBytes.slice(offset, offset + blockLen);
    offset += blockLen;
    dataBlocks.push(blockData);
    ecBlocks.push(rsCalculateCodewords(blockData, ecPerBlock));
  }

  const result = [];
  const maxDataBlockLen = baseBlockLen + (extraBlocks > 0 ? 1 : 0);

  for (let i = 0; i < maxDataBlockLen; i++) {
    for (let b = 0; b < numBlocks; b++) {
      if (i < dataBlocks[b].length) {
        result.push(dataBlocks[b][i]);
      }
    }
  }

  for (let i = 0; i < ecPerBlock; i++) {
    for (let b = 0; b < numBlocks; b++) {
      result.push(ecBlocks[b][i]);
    }
  }

  return result;
}

function selectVersion(textLength, requestedEcLevel = 'M') {
  let table = requestedEcLevel === 'L' ? VERSION_CAPACITY_L : VERSION_CAPACITY_M;
  for (let v = 1; v < table.length; v++) {
    const countBits = v < 10 ? 8 : 16;
    const headerBytes = Math.ceil((4 + countBits) / 8);
    if (textLength + headerBytes <= table[v].data) {
      return { version: v, capacity: table[v], ecLevel: requestedEcLevel };
    }
  }

  // Graceful fallback: If Level M overflowed, automatically check Level L
  if (requestedEcLevel !== 'L') {
    table = VERSION_CAPACITY_L;
    for (let v = 1; v < table.length; v++) {
      const countBits = v < 10 ? 8 : 16;
      const headerBytes = Math.ceil((4 + countBits) / 8);
      if (textLength + headerBytes <= table[v].data) {
        return { version: v, capacity: table[v], ecLevel: 'L' };
      }
    }
  }

  throw new Error(`Data too large for QR generator (${textLength} bytes, max capacity: ${table[table.length - 1].data} bytes)`);
}

/**
 * Generates a 2D QR matrix for text payload.
 *
 * @param {string} text - Payload to encode
 * @param {Object} [options]
 * @param {'L'|'M'} [options.ecLevel='M'] - Error correction level
 * @param {number} [options.maskPattern=0] - QR mask pattern (0..7)
 * @returns {boolean[][]} - 2D matrix where true = dark module, false = light module
 */
function generateQrMatrix(text, options = {}) {
  const requestedEcLevel = options.ecLevel === 'L' ? 'L' : 'M';
  const textBytes = Buffer.from(text, 'utf8');

  const { version, capacity, ecLevel } = selectVersion(textBytes.length, requestedEcLevel);
  const matrixSize = 17 + 4 * version;

  const matrix = Array.from({ length: matrixSize }, () => new Array(matrixSize).fill(null));
  const isFunction = Array.from({ length: matrixSize }, () => new Array(matrixSize).fill(false));

  function setModule(r, c, val, func = true) {
    matrix[r][c] = val;
    if (func) isFunction[r][c] = true;
  }

  function addFinderPattern(row, col) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr < 0 || nr >= matrixSize || nc < 0 || nc >= matrixSize) continue;

        if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
          if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
            setModule(nr, nc, true);
          } else {
            setModule(nr, nc, false);
          }
        } else {
          setModule(nr, nc, false);
        }
      }
    }
  }

  addFinderPattern(0, 0);
  addFinderPattern(0, matrixSize - 7);
  addFinderPattern(matrixSize - 7, 0);

  for (let i = 8; i < matrixSize - 8; i++) {
    const val = i % 2 === 0;
    if (matrix[6][i] === null) setModule(6, i, val);
    if (matrix[i][6] === null) setModule(i, 6, val);
  }

  const alignCoords = ALIGNMENT_PATTERN_POS[version] || [];
  for (let i = 0; i < alignCoords.length; i++) {
    for (let j = 0; j < alignCoords.length; j++) {
      const r = alignCoords[i];
      const c = alignCoords[j];
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= matrixSize - 8) || (r >= matrixSize - 8 && c <= 8)) {
        continue;
      }
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const isBorder = Math.abs(dr) === 2 || Math.abs(dc) === 2;
          const isCenter = dr === 0 && dc === 0;
          setModule(r + dr, c + dc, isBorder || isCenter);
        }
      }
    }
  }

  setModule(4 * version + 9, 8, true);

  for (let i = 0; i <= 8; i++) {
    if (matrix[8][i] === null) setModule(8, i, false);
    if (matrix[i][8] === null) setModule(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    if (matrix[8][matrixSize - 1 - i] === null) setModule(8, matrixSize - 1 - i, false);
    if (matrix[matrixSize - 1 - i][8] === null) setModule(matrixSize - 1 - i, 8, false);
  }

  const dataBytes = encodeBitstream(text, version, capacity);
  const codewords = buildCodewords(dataBytes, capacity);

  const bits = [];
  for (let i = 0; i < codewords.length; i++) {
    for (let b = 7; b >= 0; b--) {
      bits.push((codewords[i] >> b) & 1);
    }
  }

  const maskPattern = typeof options.maskPattern === 'number' ? (options.maskPattern % 8) : 0;

  function isMasked(r, c, pattern) {
    switch (pattern) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      case 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
      default: return (r + c) % 2 === 0;
    }
  }

  let bitIdx = 0;
  let upwards = true;

  for (let col = matrixSize - 1; col > 0; col -= 2) {
    if (col === 6) col--;

    const rowStart = upwards ? matrixSize - 1 : 0;
    const rowEnd = upwards ? -1 : matrixSize;
    const rowStep = upwards ? -1 : 1;

    for (let row = rowStart; row !== rowEnd; row += rowStep) {
      for (let c = 0; c < 2; c++) {
        const curCol = col - c;
        if (!isFunction[row][curCol]) {
          let bit = bitIdx < bits.length ? bits[bitIdx] : 0;
          bitIdx++;

          if (isMasked(row, curCol, maskPattern)) {
            bit ^= 1;
          }
          matrix[row][curCol] = Boolean(bit);
        }
      }
    }
    upwards = !upwards;
  }

  const formatBits = FORMAT_INFO[ecLevel][maskPattern];

  for (let i = 0; i < 6; i++) {
    matrix[8][i] = Boolean((formatBits >> (14 - i)) & 1);
  }
  matrix[8][7] = Boolean((formatBits >> 8) & 1);
  matrix[8][8] = Boolean((formatBits >> 7) & 1);
  matrix[7][8] = Boolean((formatBits >> 6) & 1);
  for (let i = 0; i < 6; i++) {
    matrix[5 - i][8] = Boolean((formatBits >> i) & 1);
  }

  for (let i = 0; i < 7; i++) {
    matrix[matrixSize - 1 - i][8] = Boolean((formatBits >> i) & 1);
  }
  for (let i = 0; i < 8; i++) {
    matrix[8][matrixSize - 8 + i] = Boolean((formatBits >> (7 + i)) & 1);
  }

  return matrix;
}

function generateQrSvg(text, options = {}) {
  const matrix = generateQrMatrix(text, options);
  const matrixSize = matrix.length;
  const margin = typeof options.margin === 'number' ? options.margin : 2;
  const totalModules = matrixSize + margin * 2;
  const size = options.size || 240;
  const darkColor = options.darkColor || '#000000';
  const lightColor = options.lightColor || '#ffffff';

  let path = '';
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c]) {
        const x = c + margin;
        const y = r + margin;
        path += `M${x},${y}h1v1h-1z `;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalModules} ${totalModules}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="QR Code for ${escapeXml(text)}">` +
    `<rect width="100%" height="100%" fill="${lightColor}"/>` +
    `<path d="${path.trim()}" fill="${darkColor}"/>` +
    `</svg>`;
}

function generateQrDataUrl(text, options = {}) {
  const svg = generateQrSvg(text, options);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = {
  generateQrMatrix,
  generateQrSvg,
  generateQrDataUrl,
};
