import * as QRCode from 'qrcode';
import type { QRCodeErrorCorrectionLevel, QRCodeMaskPattern } from 'qrcode';

export interface QrRenderOptions {
  size?: number;
  margin?: number;
  darkColor?: string;
  lightColor?: string;
  ecLevel?: 'L' | 'M';
  maskPattern?: number;
}

function createMatrix(text: string, options: QrRenderOptions) {
  if (!text) throw new Error('QR payload is empty');
  try {
    return QRCode.create(text, {
      errorCorrectionLevel: (options.ecLevel || 'M') as QRCodeErrorCorrectionLevel,
      maskPattern: options.maskPattern as QRCodeMaskPattern | undefined,
    }).modules;
  } catch (error) {
    throw new Error(`Data too large or invalid for QR generator: ${String(error)}`);
  }
}

export function generateQrMatrix(text: string, options: QrRenderOptions = {}): boolean[][] {
  const modules = createMatrix(text, options);
  return Array.from({ length: modules.size }, (_, row) =>
    Array.from({ length: modules.size }, (_, col) => Boolean(modules.data[row * modules.size + col]))
  );
}

export function generateQrSvg(text: string, options: QrRenderOptions = {}): string {
  const matrix = generateQrMatrix(text, options);
  const margin = options.margin ?? 4;
  const size = options.size ?? 240;
  const darkColor = options.darkColor ?? '#000000';
  const lightColor = options.lightColor ?? '#FFFFFF';
  const totalModules = matrix.length + margin * 2;
  let path = '';

  for (let row = 0; row < matrix.length; row++) {
    for (let col = 0; col < matrix.length; col++) {
      if (matrix[row][col]) path += `M${col + margin},${row + margin}h1v1h-1z`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalModules} ${totalModules}" width="${size}" height="${size}" shape-rendering="crispEdges">` +
    `<rect width="100%" height="100%" fill="${lightColor}"/>` +
    `<path d="${path}" fill="${darkColor}"/>` +
    `</svg>`;
}
