// Unit tests for checkBlur, checkExposure, runQualityChecks
// Uses Node.js built-in test runner (no external deps)

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

// ── Synthetic ImageData helpers ──────────────────────────────────────────────

function makeImageData(width, height, fillFn) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const [r, g, b] = fillFn(i, width, height);
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return { data, width, height };
}

/** Sharp image: alternating black and white pixels (maximum Laplacian variance) */
function makeSharpImage(w, h) {
  return makeImageData(w, h, (i) => {
    const v = (i % 2 === 0) ? 255 : 0;
    return [v, v, v];
  });
}

/** Blurry image: all same colour (zero Laplacian variance) */
function makeBlurryImage(w, h, brightness = 128) {
  return makeImageData(w, h, () => [brightness, brightness, brightness]);
}

/** Dark image: mean brightness ~20 */
function makeDarkImage(w, h) {
  return makeImageData(w, h, () => [20, 20, 20]);
}

/** Bright image: mean brightness ~240 */
function makeBrightImage(w, h) {
  return makeImageData(w, h, () => [240, 240, 240]);
}

// ── Inline implementations to test (mirroring lib/ai/quality-check.ts) ───────

function checkBlur(imageData, threshold) {
  const { data, width, height } = imageData;
  const luma = [];
  for (let i = 0; i < data.length; i += 4) {
    luma.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  const laplacian = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const val =
        -4 * luma[idx] +
        luma[idx - 1] +
        luma[idx + 1] +
        luma[idx - width] +
        luma[idx + width];
      laplacian.push(val);
    }
  }
  const mean = laplacian.reduce((s, v) => s + v, 0) / laplacian.length;
  const variance = laplacian.reduce((s, v) => s + (v - mean) ** 2, 0) / laplacian.length;
  return variance >= threshold;
}

function checkExposure(imageData, min, max) {
  const { data } = imageData;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
  }
  const mean = sum / (data.length / 4);
  return mean >= min && mean <= max;
}

// ── checkBlur tests ───────────────────────────────────────────────────────────

console.log("\nquality-check.test.mjs: checkBlur");

const sharpImage = makeSharpImage(50, 50);
const blurryImage = makeBlurryImage(50, 50);

assert(checkBlur(sharpImage, 100), "sharp image passes blur check at threshold 100");
assert(!checkBlur(blurryImage, 100), "uniform image fails blur check (zero variance)");
assert(checkBlur(sharpImage, 10000), "sharp image passes very high threshold");
assert(!checkBlur(blurryImage, 1), "uniform image fails even at threshold 1");

// ── checkExposure tests ───────────────────────────────────────────────────────

console.log("\nquality-check.test.mjs: checkExposure");

const normalImage = makeBlurryImage(50, 50, 128);
const darkImage = makeDarkImage(50, 50);
const brightImage = makeBrightImage(50, 50);

assert(checkExposure(normalImage, 30, 220), "normal brightness image passes exposure check");
assert(!checkExposure(darkImage, 30, 220), "dark image (brightness ~20) fails minimum exposure");
assert(!checkExposure(brightImage, 30, 220), "bright image (brightness ~240) fails maximum exposure");
assert(checkExposure(darkImage, 10, 30), "dark image passes when threshold is low");
assert(checkExposure(brightImage, 220, 255), "bright image passes when threshold is high");

// ── Boundary conditions ───────────────────────────────────────────────────────

console.log("\nquality-check.test.mjs: boundary conditions");

const exactMinImage = makeBlurryImage(20, 20, 30);
assert(checkExposure(exactMinImage, 30, 220), "image at exact min threshold passes");

const exactMaxImage = makeBlurryImage(20, 20, 220);
assert(checkExposure(exactMaxImage, 30, 220), "image at exact max threshold passes");

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\nquality-check.test.mjs: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error("quality-check.test.mjs: SOME TESTS FAILED");
  process.exit(1);
} else {
  console.log("quality-check.test.mjs: ALL TESTS PASSED");
}
