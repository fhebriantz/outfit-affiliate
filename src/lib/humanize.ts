// "Humanizer" untuk gambar — meniru batch_humanizer/humanizer.py (versi image):
// grain/noise + color jitter (brightness, contrast, saturation, gamma R/B).
// Tujuannya memperturbasi pola halus agar fingerprint AI di piksel berkurang.
// Re-encode kanvas (toBlob) juga otomatis membuang metadata EXIF/AI.

import piexif from 'piexifjs'

const GRAIN_INTENSITY = 0.03

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Bytes EXIF lengkap ala iPhone 13 (back wide camera) untuk disisipkan ke JPEG.
 * Beberapa nilai (ISO, exposure) divariasikan acak tiap panggilan agar tidak identik.
 */
export function iphoneExifBytes(w: number, h: number): string {
  const n = new Date()
  const p = (x: number) => String(x).padStart(2, '0')
  const dt = `${n.getFullYear()}:${p(n.getMonth() + 1)}:${p(n.getDate())} ${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`
  const subsec = String(Math.floor(Math.random() * 1000)).padStart(3, '0')

  const iso = pick([32, 40, 50, 64, 80, 100, 125])
  const expo = pick([
    [1, 60],
    [1, 100],
    [1, 120],
    [1, 50],
    [1, 200],
  ])

  const I = piexif.ImageIFD
  const E = piexif.ExifIFD

  const zeroth: Record<number, unknown> = {
    [I.Make]: 'Apple',
    [I.Model]: 'iPhone 13',
    [I.Software]: '16.6',
    [I.DateTime]: dt,
    [I.HostComputer]: 'iPhone 13',
    [I.Orientation]: 1,
    [I.XResolution]: [72, 1],
    [I.YResolution]: [72, 1],
    [I.ResolutionUnit]: 2,
    [I.YCbCrPositioning]: 1,
  }

  const exif: Record<number, unknown> = {
    [E.ExposureTime]: expo,
    [E.FNumber]: [16, 10], // f/1.6
    [E.ExposureProgram]: 2, // normal program
    [E.ISOSpeedRatings]: iso,
    [E.ExifVersion]: '0232',
    [E.DateTimeOriginal]: dt,
    [E.DateTimeDigitized]: dt,
    [E.SubSecTimeOriginal]: subsec,
    [E.SubSecTimeDigitized]: subsec,
    [E.ShutterSpeedValue]: [Math.round(Math.log2(expo[1] / expo[0]) * 1000), 1000],
    [E.ApertureValue]: [1357, 1000], // ~f/1.6 APEX
    [E.BrightnessValue]: [pick([2, 3, 4, 5]) * 1000, 1000],
    [E.ExposureBiasValue]: [0, 1],
    [E.MeteringMode]: 5, // pattern
    [E.Flash]: 16, // off, did not fire
    [E.FocalLength]: [510, 100], // 5.1mm
    [E.ColorSpace]: 1, // sRGB
    [E.PixelXDimension]: w,
    [E.PixelYDimension]: h,
    [E.FocalLengthIn35mmFilm]: 26,
    [E.SceneCaptureType]: 0,
    [E.SensingMethod]: 2,
    [E.ExposureMode]: 0,
    [E.WhiteBalance]: 0,
    [E.LensSpecification]: [
      [1568, 1000],
      [5100, 1000],
      [16, 10],
      [24, 10],
    ],
    [E.LensMake]: 'Apple',
    [E.LensModel]: 'iPhone 13 back dual wide camera 5.1mm f/1.6',
  }

  return piexif.dump({ '0th': zeroth, Exif: exif, GPS: {}, '1st': {}, thumbnail: null })
}

/** Sisipkan EXIF iPhone 13 ke data URL JPEG. Kalau gagal, kembalikan apa adanya. */
export function injectIphoneExif(jpegDataUrl: string, w: number, h: number): string {
  try {
    return piexif.insert(iphoneExifBytes(w, h), jpegDataUrl)
  } catch {
    return jpegDataUrl
  }
}

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
