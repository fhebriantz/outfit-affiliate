// "Humanizer" untuk gambar — meniru batch_humanizer/humanizer.py (versi image):
// grain/noise + color jitter (brightness, contrast, saturation, gamma R/B).
// Tujuannya memperturbasi pola halus agar fingerprint AI di piksel berkurang.
// Re-encode kanvas (toBlob) juga otomatis membuang metadata EXIF/AI.

const GRAIN_INTENSITY = 0.03

function rnd(min: number, max: number) {
  return min + Math.random() * (max - min)
}

/** Terapkan grain + color jitter acak pada isi canvas (in-place). */
export function humanizeCanvas(ctx: CanvasRenderingContext2D, w: number, h: number) {
  if (w <= 0 || h <= 0) return
  const brightness = 1 + rnd(-0.02, 0.02)
  const contrast = rnd(1.0, 1.05)
  const saturation = rnd(1.0, 1.1)
  const gammaR = rnd(0.98, 1.02)
  const gammaB = rnd(0.98, 1.02)

  // LUT gamma untuk channel R & B (warm/cool shift halus).
  const lutR = new Uint8ClampedArray(256)
  const lutB = new Uint8ClampedArray(256)
  for (let i = 0; i < 256; i++) {
    lutR[i] = Math.round(255 * Math.pow(i / 255, 1 / gammaR))
    lutB[i] = Math.round(255 * Math.pow(i / 255, 1 / gammaB))
  }

  const image = ctx.getImageData(0, 0, w, h)
  const d = image.data
  const g1 = 1 - GRAIN_INTENSITY
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i]
    let g = d[i + 1]
    let b = d[i + 2]
    // brightness
    r *= brightness
    g *= brightness
    b *= brightness
    // contrast (sekitar mid 128)
    r = 128 + (r - 128) * contrast
    g = 128 + (g - 128) * contrast
    b = 128 + (b - 128) * contrast
    // saturation (sekitar luminance)
    const L = 0.299 * r + 0.587 * g + 0.114 * b
    r = L + (r - L) * saturation
    g = L + (g - L) * saturation
    b = L + (b - L) * saturation
    // clamp lalu gamma R/B via LUT
    r = r < 0 ? 0 : r > 255 ? 255 : r
    b = b < 0 ? 0 : b > 255 ? 255 : b
    r = lutR[r | 0]
    b = lutB[b | 0]
    // grain (noise acak per channel per piksel)
    d[i] = r * g1 + Math.random() * 255 * GRAIN_INTENSITY
    d[i + 1] = g * g1 + Math.random() * 255 * GRAIN_INTENSITY
    d[i + 2] = b * g1 + Math.random() * 255 * GRAIN_INTENSITY
    // alpha (d[i+3]) dibiarkan
  }
  ctx.putImageData(image, 0, 0)
}
