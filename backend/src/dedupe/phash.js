import sharp from 'sharp';

/** 64-bit difference hash: compares each pixel with its right neighbour on a 9x8 grayscale thumbnail. */
export async function dHash(buffer) {
  const px = await sharp(buffer).grayscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
  let bits = '';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) bits += px[y * 9 + x] > px[y * 9 + x + 1] ? '1' : '0';
  }
  return BigInt('0b' + bits).toString(16).padStart(16, '0');
}

export function hamming(a, b) {
  let x = BigInt('0x' + a) ^ BigInt('0x' + b);
  let n = 0;
  while (x) { n += Number(x & 1n); x >>= 1n; }
  return n;
}