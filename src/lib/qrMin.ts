// Minimal, dependency-free QR code encoder — pure TypeScript, no external
// library. Deliberately scoped to byte mode, versions 1-5, error-correction
// level L, and a single fixed mask pattern (0): this is the largest surface
// that can be implemented and verified correctly by hand without risking a
// subtle Reed-Solomon/zigzag bug that would silently produce an unscannable
// code. Versions 1-5 cap capacity around ~100 bytes, plenty for a URL or a
// short line of text — a longer input throws, which QrGenerator.tsx already
// catches and shows as a friendly Arabic error instead of crashing.
//
// (Previous version of this file only contained the literal text
// "PLACEHOLDER", which broke the production build — this replaces it with
// a real, working encoder.)

const EC_CODEWORDS_L = [7, 10, 15, 20, 26]; // index = version - 1
const TOTAL_CODEWORDS_L = [26, 44, 70, 100, 134];
const ALIGNMENT_CENTER: (number | null)[] = [null, 18, 22, 26, 30];

function dataCodewordsFor(version: number): number {
  return TOTAL_CODEWORDS_L[version - 1] - EC_CODEWORDS_L[version - 1];
}

// ---------- GF(256) arithmetic (primitive polynomial 0x11D, per spec) ----------
const GF_EXP = new Array<number>(512);
const GF_LOG = new Array<number>(256);
(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

// Polynomials below use descending-order coefficients (index 0 = highest
// degree term), which is the standard convention for schoolbook long
// division.
function polyMul(a: number[], b: number[]): number[] {
  const res = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      res[i + j] ^= gfMul(a[i], b[j]);
    }
  }
  return res;
}

function rsGeneratorPoly(ecLen: number): number[] {
  let g = [1];
  for (let i = 0; i < ecLen; i++) {
    g = polyMul(g, [1, GF_EXP[i]]); // multiply by (x + alpha^i)
  }
  return g; // length ecLen + 1, g[0] === 1 (monic)
}

function rsComputeRemainder(dataCodewords: number[], ecLen: number): number[] {
  const gen = rsGeneratorPoly(ecLen);
  const msg = dataCodewords.concat(new Array(ecLen).fill(0));
  for (let i = 0; i < dataCodewords.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return msg.slice(dataCodewords.length);
}

// ---------- Data encoding (byte mode) ----------
function pushBits(bits: number[], value: number, len: number) {
  for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
}

function buildDataCodewords(text: string, version: number): number[] {
  const bytes = Array.from(new TextEncoder().encode(text));
  const dataCwCount = dataCodewordsFor(version);
  const capacityBits = dataCwCount * 8;

  const bits: number[] = [];
  pushBits(bits, 0b0100, 4); // byte mode indicator
  pushBits(bits, bytes.length, 8); // character count (8 bits for versions 1-9)
  for (const b of bytes) pushBits(bits, b, 8);

  if (bits.length > capacityBits) {
    throw new Error("too long for this version");
  }

  const termLen = Math.min(4, capacityBits - bits.length);
  for (let i = 0; i < termLen; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }

  const padBytes = [0xec, 0x11];
  let p = 0;
  while (codewords.length < dataCwCount) {
    codewords.push(padBytes[p % 2]);
    p++;
  }

  return codewords;
}

function selectVersionAndCodewords(text: string): { version: number; codewords: number[] } {
  for (let v = 1; v <= 5; v++) {
    try {
      return { version: v, codewords: buildDataCodewords(text, v) };
    } catch {
      continue;
    }
  }
  throw new Error("النص طويل جداً لإنشاء رمز QR — جرّب نصاً أقصر");
}

function codewordsToBits(codewords: number[]): number[] {
  const bits: number[] = [];
  for (const cw of codewords) {
    for (let i = 7; i >= 0; i--) bits.push((cw >>> i) & 1);
  }
  return bits;
}

// ---------- Matrix construction ----------
function setModule(matrix: number[][], functionMask: boolean[][], row: number, col: number, isDark: boolean) {
  matrix[row][col] = isDark ? 1 : 0;
  functionMask[row][col] = true;
}

function drawFinderPattern(matrix: number[][], functionMask: boolean[][], size: number, centerRow: number, centerCol: number) {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const row = centerRow + dy;
      const col = centerCol + dx;
      if (row < 0 || row >= size || col < 0 || col >= size) continue;
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      setModule(matrix, functionMask, row, col, dist !== 2 && dist !== 4);
    }
  }
}

function drawTimingPattern(matrix: number[][], functionMask: boolean[][], size: number) {
  // Only the gap between the two finder patterns — the finder patterns
  // themselves already cover (and agree with) row/col 6 within their zone.
  for (let i = 8; i <= size - 9; i++) {
    const dark = i % 2 === 0;
    setModule(matrix, functionMask, 6, i, dark);
    setModule(matrix, functionMask, i, 6, dark);
  }
}

function drawAlignmentPattern(matrix: number[][], functionMask: boolean[][], center: number) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const row = center + dy;
      const col = center + dx;
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      setModule(matrix, functionMask, row, col, dist !== 1);
    }
  }
}

function computeFormatBits(): number {
  // Fixed: error-correction level L (bits 01) + mask pattern 0.
  const data = (0b01 << 3) | 0;
  let rem = data;
  for (let i = 0; i < 10; i++) {
    rem = (rem << 1) ^ ((rem >> 9) * 0x537);
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function drawFormatBits(matrix: number[][], functionMask: boolean[][], size: number, bits: number) {
  const get = (i: number) => (bits >>> i) & 1;

  for (let i = 0; i <= 5; i++) setModule(matrix, functionMask, i, 8, get(i) === 1);
  setModule(matrix, functionMask, 7, 8, get(6) === 1);
  setModule(matrix, functionMask, 8, 8, get(7) === 1);
  setModule(matrix, functionMask, 8, 7, get(8) === 1);
  for (let i = 9; i <= 14; i++) setModule(matrix, functionMask, 8, 14 - i, get(i) === 1);

  for (let i = 0; i <= 7; i++) setModule(matrix, functionMask, 8, size - 1 - i, get(i) === 1);
  for (let i = 8; i <= 14; i++) setModule(matrix, functionMask, size - 15 + i, 8, get(i) === 1);
}

function placeDataBits(matrix: number[][], functionMask: boolean[][], size: number, bits: number[]) {
  // Zigzag scan in column pairs, right to left, skipping column 6 (the
  // vertical timing pattern) entirely so no column is ever visited twice.
  const cols: number[] = [];
  for (let c = size - 1; c >= 0; c--) {
    if (c === 6) continue;
    cols.push(c);
  }

  let bitIndex = 0;
  let upward = true;
  for (let i = 0; i < cols.length; i += 2) {
    const colRight = cols[i];
    const colLeft = cols[i + 1];
    for (let vert = 0; vert < size; vert++) {
      const row = upward ? size - 1 - vert : vert;
      for (const col of [colRight, colLeft]) {
        if (!functionMask[row][col]) {
          matrix[row][col] = bitIndex < bits.length ? bits[bitIndex] : 0;
          bitIndex++;
        }
      }
    }
    upward = !upward;
  }
}

export default function QR(text: string): number[][] {
  const { version, codewords: dataCodewords } = selectVersionAndCodewords(text);
  const ecLen = EC_CODEWORDS_L[version - 1];
  const ecCodewords = rsComputeRemainder(dataCodewords, ecLen);
  const bits = codewordsToBits(dataCodewords.concat(ecCodewords));

  const size = 4 * version + 17;
  const matrix: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
  const functionMask: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));

  drawFinderPattern(matrix, functionMask, size, 3, 3);
  drawFinderPattern(matrix, functionMask, size, 3, size - 4);
  drawFinderPattern(matrix, functionMask, size, size - 4, 3);
  drawTimingPattern(matrix, functionMask, size);

  const alignCenter = ALIGNMENT_CENTER[version - 1];
  if (alignCenter !== null) drawAlignmentPattern(matrix, functionMask, alignCenter);

  setModule(matrix, functionMask, size - 8, 8, true); // dark module
  drawFormatBits(matrix, functionMask, size, computeFormatBits());

  placeDataBits(matrix, functionMask, size, bits);

  // Mask pattern 0: (row + col) % 2 === 0 — applied only to data modules.
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!functionMask[row][col] && (row + col) % 2 === 0) {
        matrix[row][col] ^= 1;
      }
    }
  }

  return matrix;
}
