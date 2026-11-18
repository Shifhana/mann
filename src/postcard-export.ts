import { formatCoordinates, type Building } from './buildings.ts';

export const POSTCARD_PNG = { width: 3000, height: 2442 } as const;
// Preserve the approved 602×490 composition without added side margins.
export const POSTCARD_LAYOUT = { width: 602, height: 490, compositionWidth: 602, padding: 20, imageWidth: 562, imageHeight: 410, footerY: 452 } as const;

/** Paint only the approved artwork. No DOM rasterisation, page UI or overlay. */
export function paintPostcard(canvas: HTMLCanvasElement, image: HTMLCanvasElement, building: Building) {
  canvas.width = POSTCARD_PNG.width;
  canvas.height = POSTCARD_PNG.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create the postcard PNG.');
  const { width, compositionWidth, padding, imageWidth, imageHeight, footerY } = POSTCARD_LAYOUT;
  // Uniform width-based scaling avoids distortion. Rounding the requested
  // pixel height leaves only .14px of additional paper at the bottom edge.
  const scale = canvas.width / width;
  context.scale(scale, scale);
  context.fillStyle = '#FAF9F6';
  context.fillRect(0, 0, width, canvas.height / scale);
  const left = (width - compositionWidth) / 2 + padding;
  // object-fit: cover, matching the preview's approved image framing.
  const fit = Math.max(imageWidth / image.width, imageHeight / image.height);
  const sw = imageWidth / fit, sh = imageHeight / fit;
  context.save();
  context.beginPath();context.roundRect(left, padding, imageWidth, imageHeight, 2);context.clip();
  context.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, left, padding, imageWidth, imageHeight);
  context.restore();
  // The entire .2px stroke is outside the image, matching CSS's spread shadow.
  context.strokeStyle = '#583622';context.lineWidth = .2;
  context.beginPath();context.roundRect(left - .1, padding - .1, imageWidth + .2, imageHeight + .2, 2.1);context.stroke();
  const text = (value: string, x: number, size: number, weight: number, color: string, align: CanvasTextAlign, spacing = 0) => {
    // Match the preview's complete stack, including its prime/degree fallback.
    context.font = `${weight} ${size}px 'DM Mono', monospace`;
    context.textAlign = align;context.textBaseline = 'alphabetic';
    context.letterSpacing = `${spacing}px`;context.fillStyle = color;
    const metrics = context.measureText(value);
    // CSS centres each font's line box on the same footer axis.
    const baseline = footerY + (metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2;
    context.fillText(value, x, baseline);
  };
  text(building.name.toUpperCase(), left, 12, 500, '#583622', 'left', .48);
  text(formatCoordinates(building), width / 2, 11, 400, '#77716B', 'center');
  text(building.location.toUpperCase(), left + imageWidth, 12, 500, '#807060', 'right', .48);
}

export async function postcardPng(capture: () => HTMLCanvasElement, building: Building): Promise<Blob> {
  const fonts = await Promise.all([document.fonts.load("400 11px 'DM Mono'"), document.fonts.load("500 12px 'DM Mono'")]);
  if (fonts.some(faces => !faces.length) || !document.fonts.check("400 11px 'DM Mono'") || !document.fonts.check("500 12px 'DM Mono'")) throw new Error('The postcard fonts are unavailable.');
  const image = capture(), canvas = document.createElement('canvas');
  try {
    paintPostcard(canvas, image, building);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG encoding failed.')), 'image/png'));
  } finally {
    // Release both large CPU rasters after encoding; only the PNG is cached.
    canvas.width = canvas.height = image.width = image.height = 0;
  }
}

export function postcardFilename(building: Building) {
  const name = building.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'building';
  return `mann-${name}-postcard.png`;
}
