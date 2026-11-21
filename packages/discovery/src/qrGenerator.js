'use strict';

const QRCode = require('qrcode');

function generateQrMatrix(text, options = {}) {
  if (!text) throw new Error('QR payload is empty');
  let modules;
  try {
    modules = QRCode.create(text, {
      errorCorrectionLevel: options.ecLevel || 'M',
      maskPattern: options.maskPattern,
    }).modules;
  } catch (error) {
    throw new Error(`Data too large or invalid for QR generator: ${String(error)}`);
  }

  return Array.from({ length: modules.size }, (_, row) =>
    Array.from({ length: modules.size }, (_, col) => Boolean(modules.data[row * modules.size + col]))
  );
}

function generateQrSvg(text, options = {}) {
  const matrix = generateQrMatrix(text, options);
  const margin = options.margin ?? 4;
  const size = options.size ?? 240;
  const darkColor = options.darkColor ?? '#000000';
  const lightColor = options.lightColor ?? '#ffffff';
  const totalModules = matrix.length + margin * 2;
  let path = '';

  for (let row = 0; row < matrix.length; row++) {
    for (let col = 0; col < matrix.length; col++) {
      if (matrix[row][col]) path += `M${col + margin},${row + margin}h1v1h-1z`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalModules} ${totalModules}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="QR Code for ${escapeXml(text)}">` +
    `<rect width="100%" height="100%" fill="${lightColor}"/>` +
    `<path d="${path}" fill="${darkColor}"/>` +
    `</svg>`;
}

function generateQrDataUrl(text, options = {}) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(generateQrSvg(text, options))}`;
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = { generateQrMatrix, generateQrSvg, generateQrDataUrl };
