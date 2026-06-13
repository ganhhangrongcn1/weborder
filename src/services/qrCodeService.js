const QR_VERSION = 4;
const QR_SIZE = QR_VERSION * 4 + 17;
const DATA_CODEWORDS = 80;
const ECC_CODEWORDS = 20;
const REMAINDER_BITS = 7;
const ALIGNMENT_POSITIONS = [6, 26];
const FORMAT_ERROR_LEVEL_L = 0b01;
const FORMAT_MASK_PATTERN = 0;

const DEFAULT_MODULE_SIZE = 12;
const DEFAULT_QUIET_ZONE = 4;

const createMatrix = (value = null) => Array.from({ length: QR_SIZE }, () => Array(QR_SIZE).fill(value));

const appendBits = (bits, value, length) => {
  for (let index = length - 1; index >= 0; index -= 1) {
    bits.push(((value >>> index) & 1) === 1);
  }
};

const setModule = (matrix, reserved, x, y, value, isReserved = true) => {
  if (x < 0 || y < 0 || x >= QR_SIZE || y >= QR_SIZE) return;
  matrix[y][x] = Boolean(value);
  if (isReserved) reserved[y][x] = true;
};

const drawFinder = (matrix, reserved, x, y) => {
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      const isCore = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
      const isBlack =
        isCore && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
      setModule(matrix, reserved, x + dx, y + dy, isBlack);
    }
  }
};

const drawBasePatterns = (matrix, reserved) => {
  drawFinder(matrix, reserved, 0, 0);
  drawFinder(matrix, reserved, QR_SIZE - 7, 0);
  drawFinder(matrix, reserved, 0, QR_SIZE - 7);

  for (let index = 8; index < QR_SIZE - 8; index += 1) {
    const isBlack = index % 2 === 0;
    setModule(matrix, reserved, index, 6, isBlack);
    setModule(matrix, reserved, 6, index, isBlack);
  }

  ALIGNMENT_POSITIONS.forEach((cx) => {
    ALIGNMENT_POSITIONS.forEach((cy) => {
      if ((cx === 6 && cy === 6) || (cx === 6 && cy === QR_SIZE - 7) || (cx === QR_SIZE - 7 && cy === 6)) return;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          setModule(matrix, reserved, cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    });
  });

  setModule(matrix, reserved, 8, QR_SIZE - 8, true);

  for (let index = 0; index < 9; index += 1) {
    if (index !== 6) {
      setModule(matrix, reserved, 8, index, false);
      setModule(matrix, reserved, index, 8, false);
    }
  }

  for (let index = 0; index < 8; index += 1) {
    setModule(matrix, reserved, QR_SIZE - 1 - index, 8, false);
    setModule(matrix, reserved, 8, QR_SIZE - 1 - index, false);
  }
};

const makeDataCodewords = (text) => {
  const bytes = new TextEncoder().encode(text);
  const bits = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);
  bytes.forEach((byte) => appendBits(bits, byte, 8));

  const capacityBits = DATA_CODEWORDS * 8;
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8 !== 0) bits.push(false);

  const data = [];
  for (let index = 0; index < bits.length; index += 8) {
    let byte = 0;
    for (let offset = 0; offset < 8; offset += 1) {
      byte = (byte << 1) | (bits[index + offset] ? 1 : 0);
    }
    data.push(byte);
  }

  let pad = 0xec;
  while (data.length < DATA_CODEWORDS) {
    data.push(pad);
    pad = pad === 0xec ? 0x11 : 0xec;
  }
  return data;
};

const gfMultiply = (x, y) => {
  let result = 0;
  for (let index = 7; index >= 0; index -= 1) {
    result = (result << 1) ^ ((result >>> 7) * 0x11d);
    result ^= ((y >>> index) & 1) * x;
  }
  return result & 0xff;
};

const reedSolomonGenerator = (degree) => {
  let result = [1];
  let root = 1;
  for (let index = 0; index < degree; index += 1) {
    const next = Array(result.length + 1).fill(0);
    result.forEach((value, valueIndex) => {
      next[valueIndex] ^= gfMultiply(value, root);
      next[valueIndex + 1] ^= value;
    });
    result = next;
    root = gfMultiply(root, 0x02);
  }
  return result;
};

const makeErrorCorrection = (data) => {
  const divisor = reedSolomonGenerator(ECC_CODEWORDS);
  const result = Array(ECC_CODEWORDS).fill(0);

  data.forEach((byte) => {
    const factor = byte ^ result.shift();
    result.push(0);
    divisor.forEach((value, index) => {
      result[index] ^= gfMultiply(value, factor);
    });
  });

  return result;
};

const makeCodewordBits = (text) => {
  const data = makeDataCodewords(text);
  const ecc = makeErrorCorrection(data);
  const bits = [];
  [...data, ...ecc].forEach((byte) => appendBits(bits, byte, 8));
  for (let index = 0; index < REMAINDER_BITS; index += 1) bits.push(false);
  return bits;
};

const shouldMask = (x, y) => (x + y) % 2 === 0;

const placeData = (matrix, reserved, bits) => {
  let bitIndex = 0;
  let upward = true;

  for (let right = QR_SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;

    for (let vertical = 0; vertical < QR_SIZE; vertical += 1) {
      const y = upward ? QR_SIZE - 1 - vertical : vertical;
      for (let dx = 0; dx < 2; dx += 1) {
        const x = right - dx;
        if (reserved[y][x]) continue;

        const raw = bitIndex < bits.length ? bits[bitIndex] : false;
        matrix[y][x] = raw !== shouldMask(x, y);
        bitIndex += 1;
      }
    }
    upward = !upward;
  }
};

const drawFormatBits = (matrix, reserved) => {
  const formatData = (FORMAT_ERROR_LEVEL_L << 3) | FORMAT_MASK_PATTERN;
  let formatValue = formatData << 10;
  const generator = 0x537;

  for (let index = 14; index >= 10; index -= 1) {
    if (((formatValue >>> index) & 1) === 1) {
      formatValue ^= generator << (index - 10);
    }
  }

  const formatBits = ((formatData << 10) | formatValue) ^ 0x5412;
  const positionsA = [
    [8, 0],
    [8, 1],
    [8, 2],
    [8, 3],
    [8, 4],
    [8, 5],
    [8, 7],
    [8, 8],
    [7, 8],
    [5, 8],
    [4, 8],
    [3, 8],
    [2, 8],
    [1, 8],
    [0, 8],
  ];
  const positionsB = [
    [QR_SIZE - 1, 8],
    [QR_SIZE - 2, 8],
    [QR_SIZE - 3, 8],
    [QR_SIZE - 4, 8],
    [QR_SIZE - 5, 8],
    [QR_SIZE - 6, 8],
    [QR_SIZE - 7, 8],
    [QR_SIZE - 8, 8],
    [8, QR_SIZE - 7],
    [8, QR_SIZE - 6],
    [8, QR_SIZE - 5],
    [8, QR_SIZE - 4],
    [8, QR_SIZE - 3],
    [8, QR_SIZE - 2],
    [8, QR_SIZE - 1],
  ];

  for (let index = 0; index < 15; index += 1) {
    const value = ((formatBits >>> index) & 1) === 1;
    setModule(matrix, reserved, positionsA[index][0], positionsA[index][1], value);
    setModule(matrix, reserved, positionsB[index][0], positionsB[index][1], value);
  }
};

export const createQrMatrix = (text) => {
  const normalizedText = String(text || "").trim();
  if (!normalizedText) return createMatrix(false);

  const matrix = createMatrix();
  const reserved = createMatrix(false);
  drawBasePatterns(matrix, reserved);
  placeData(matrix, reserved, makeCodewordBits(normalizedText));
  drawFormatBits(matrix, reserved);
  return matrix;
};

export const createQrSvg = (text, options = {}) => {
  const moduleSize = options.moduleSize || DEFAULT_MODULE_SIZE;
  const quietZone = options.quietZone || DEFAULT_QUIET_ZONE;
  const darkColor = options.darkColor || "#111111";
  const lightColor = options.lightColor || "#ffffff";
  const matrix = createQrMatrix(text);
  const fullSize = (QR_SIZE + quietZone * 2) * moduleSize;
  const rects = [];

  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;
      rects.push(
        `<rect x="${(x + quietZone) * moduleSize}" y="${(y + quietZone) * moduleSize}" width="${moduleSize}" height="${moduleSize}"/>`
      );
    });
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${fullSize}" height="${fullSize}" viewBox="0 0 ${fullSize} ${fullSize}" role="img" aria-label="QR code">
  <rect width="100%" height="100%" fill="${lightColor}"/>
  <g fill="${darkColor}">
    ${rects.join("\n    ")}
  </g>
</svg>
`;
};

export const createQrPngDataUrl = (text, options = {}) => {
  const moduleSize = options.moduleSize || 16;
  const quietZone = options.quietZone || DEFAULT_QUIET_ZONE;
  const darkColor = options.darkColor || "#111111";
  const lightColor = options.lightColor || "#ffffff";
  const matrix = createQrMatrix(text);
  const canvas = document.createElement("canvas");
  const fullSize = (QR_SIZE + quietZone * 2) * moduleSize;
  canvas.width = fullSize;
  canvas.height = fullSize;

  const context = canvas.getContext("2d");
  context.fillStyle = lightColor;
  context.fillRect(0, 0, fullSize, fullSize);
  context.fillStyle = darkColor;

  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;
      context.fillRect((x + quietZone) * moduleSize, (y + quietZone) * moduleSize, moduleSize, moduleSize);
    });
  });

  return canvas.toDataURL("image/png");
};

export const downloadFile = (content, filename, type = "text/plain") => {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};
