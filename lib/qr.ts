import QRCode from './qr/vendor/index';

export type QrErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

const LEVEL_CODES: Record<QrErrorCorrectionLevel, number> = { L: 1, M: 0, Q: 3, H: 2 };

export class QrPayloadTooLongError extends Error {
  constructor(public readonly maxBytes: number) {
    super(`QR code payload too long (max ${maxBytes} bytes at level H)`);
    this.name = 'QrPayloadTooLongError';
  }
}

function toUtf8ByteString(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.codePointAt(i)!;
    if (code <= 0x7f) {
      out += String.fromCharCode(code);
    } else if (code <= 0x7ff) {
      out += String.fromCharCode(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code <= 0xffff) {
      out += String.fromCharCode(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      out += String.fromCharCode(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
      i++;
    }
  }
  return out;
}

export function generateQrMatrix(text: string, errorCorrectionLevel: QrErrorCorrectionLevel = 'M'): boolean[][] {
  const byteString = toUtf8ByteString(text);
  if (byteString.length > 2953) {
    throw new QrPayloadTooLongError(2953);
  }
  const qr = new QRCode(0, LEVEL_CODES[errorCorrectionLevel]);
  qr.addData(byteString);
  qr.make();
  const size = qr.getModuleCount();
  const matrix: boolean[][] = [];
  for (let row = 0; row < size; row++) {
    const line: boolean[] = [];
    for (let col = 0; col < size; col++) {
      line.push(qr.isDark(row, col));
    }
    matrix.push(line);
  }
  return matrix;
}
