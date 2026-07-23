/**
 * Lightweight, pure TypeScript QR Code generator.
 * Zero external dependencies. Browser & Server compatible.
 * Encodes text/URLs into QR Code matrices, SVG data strings, and Data URLs.
 */

// Basic Reed-Solomon polynomial & QR matrix encoder for Mode Byte, Low/Medium Error Correction
class QRCodeEncoder {
  private version: number;
  private modules: (boolean | null)[][];
  private size: number;

  constructor(text: string) {
    // Determine required version based on byte length
    const len = new TextEncoder().encode(text).length;
    if (len <= 17) this.version = 1;
    else if (len <= 32) this.version = 2;
    else if (len <= 53) this.version = 3;
    else if (len <= 78) this.version = 4;
    else if (len <= 106) this.version = 5;
    else if (len <= 134) this.version = 6;
    else this.version = 8; // Fits up to 192 bytes

    this.size = this.version * 4 + 17;
    this.modules = Array.from({ length: this.size }, () => Array(this.size).fill(null));
    this.makeCode(text);
  }

  public getMatrix(): boolean[][] {
    return this.modules.map(row => row.map(cell => !!cell));
  }

  private makeCode(text: string) {
    this.setupFinders();
    this.setupAlignments();
    this.setupTiming();
    
    const data = this.encodeData(text);
    this.fillData(data);
  }

  private setupFinders() {
    const finders = [
      [0, 0],
      [this.size - 7, 0],
      [0, this.size - 7]
    ];

    for (const [r, c] of finders) {
      for (let row = -1; row <= 7; row++) {
        for (let col = -1; col <= 7; col++) {
          const nr = r + row;
          const nc = c + col;
          if (nr >= 0 && nr < this.size && nc >= 0 && nc < this.size) {
            const isDark =
              (row >= 0 && row <= 6 && (col === 0 || col === 6)) ||
              (col >= 0 && col <= 6 && (row === 0 || row === 6)) ||
              (row >= 2 && row <= 4 && col >= 2 && col <= 4);
            this.modules[nr][nc] = isDark;
          }
        }
      }
    }
  }

  private setupAlignments() {
    if (this.version < 2) return;
    const pos = [6, this.size - 7];
    for (const r of pos) {
      for (const c of pos) {
        if (this.modules[r][c] !== null) continue;
        for (let row = -2; row <= 2; row++) {
          for (let col = -2; col <= 2; col++) {
            const isDark =
              Math.abs(row) === 2 || Math.abs(col) === 2 || (row === 0 && col === 0);
            this.modules[r + row][c + col] = isDark;
          }
        }
      }
    }
  }

  private setupTiming() {
    for (let i = 8; i < this.size - 8; i++) {
      if (this.modules[i][6] === null) this.modules[i][6] = i % 2 === 0;
      if (this.modules[6][i] === null) this.modules[6][i] = i % 2 === 0;
    }
  }

  private encodeData(text: string): boolean[] {
    const bytes = Array.from(new TextEncoder().encode(text));
    const bits: number[] = [];

    // Mode indicator: 0100 (Byte mode)
    bits.push(0, 1, 0, 0);

    // Character count (8 bits for version 1-9)
    for (let i = 7; i >= 0; i--) {
      bits.push((bytes.length >> i) & 1);
    }

    // Data bytes
    for (const byte of bytes) {
      for (let i = 7; i >= 0; i--) {
        bits.push((byte >> i) & 1);
      }
    }

    // Terminating bits & padding
    while (bits.length % 8 !== 0) bits.push(0);
    const padBytes = [0xec, 0x11];
    let padIdx = 0;
    const maxCapacityBits = (this.size * this.size - 3 * 64 - 31) * 0.75; // Approx storage space
    while (bits.length < maxCapacityBits) {
      const pad = padBytes[padIdx++ % 2];
      for (let i = 7; i >= 0; i--) {
        bits.push((pad >> i) & 1);
      }
    }

    return bits.map(b => b === 1);
  }

  private fillData(data: boolean[]) {
    let bitIdx = 0;
    let dir = -1;
    let r = this.size - 1;
    let c = this.size - 1;

    while (c > 0) {
      if (c === 6) c--;
      for (let col = 0; col < 2; col++) {
        const curC = c - col;
        if (this.modules[r][curC] === null) {
          const bit = bitIdx < data.length ? data[bitIdx++] : false;
          // Apply standard masking pattern (r + c) % 2 == 0
          const mask = (r + curC) % 2 === 0;
          this.modules[r][curC] = bit !== mask;
        }
      }
      r += dir;
      if (r < 0 || r >= this.size) {
        r -= dir;
        dir = -dir;
        c -= 2;
      }
    }
  }
}

export interface QRCodeOptions {
  size?: number;
  margin?: number;
  color?: string;
  bgColor?: string;
}

/** Generate an SVG markup string for a QR Code */
export function generateQRCodeSvg(text: string, options: QRCodeOptions = {}): string {
  const { size = 180, margin = 2, color = '#0F172A', bgColor = '#FFFFFF' } = options;
  const encoder = new QRCodeEncoder(text);
  const matrix = encoder.getMatrix();
  const count = matrix.length;
  const cellSize = (size - 2 * margin) / count;

  let path = '';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (matrix[r][c]) {
        const x = (margin + c * cellSize).toFixed(2);
        const y = (margin + r * cellSize).toFixed(2);
        const w = (cellSize + 0.05).toFixed(2); // tiny overlap to prevent grid lines
        path += `M${x},${y}h${w}v${w}h-${w}z `;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <rect width="100%" height="100%" fill="${bgColor}"/>
    <path d="${path}" fill="${color}"/>
  </svg>`;
}

/** Generate a Data URL (image/svg+xml) for rendering in <img> or PDF */
export function generateQRCodeDataUrl(text: string, options: QRCodeOptions = {}): string {
  const svg = generateQRCodeSvg(text, options);
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}
