import JsBarcode from "jsbarcode";
import QRCode from "qrcode";

type BarcodeEncoding = {
  data: string;
  options?: {
    width?: number;
    height?: number;
    marginLeft?: number;
    marginRight?: number;
    marginTop?: number;
    marginBottom?: number;
  };
};

type BarcodeRenderObject = {
  encodings?: BarcodeEncoding[];
};

const barcodeCache = new Map<string, string>();
const qrCache = new Map<string, string>();

function buildBarcodePath(bits: string, barWidth: number, barHeight: number) {
  let path = "";
  let index = 0;

  while (index < bits.length) {
    if (bits[index] !== "1") {
      index += 1;
      continue;
    }

    let runLength = 1;
    while (index + runLength < bits.length && bits[index + runLength] === "1") {
      runLength += 1;
    }

    path += `M${index * barWidth} 0h${runLength * barWidth}v${barHeight}H${index * barWidth}z`;
    index += runLength;
  }

  return path;
}

export function getBarcodeSvgMarkup(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const cached = barcodeCache.get(normalized);
  if (cached) {
    return cached;
  }

  const target: BarcodeRenderObject = {};
  JsBarcode(target as never, normalized, {
    format: "CODE128",
    displayValue: false,
    margin: 0,
    width: 2,
    height: 72,
  });

  const encoding = target.encodings?.[0];
  if (!encoding) {
    return null;
  }

  const barWidth = Math.max(encoding.options?.width ?? 2, 1);
  const barHeight = Math.max(encoding.options?.height ?? 72, 24);
  const quietZone = Math.max(barWidth * 6, 8);
  const totalWidth = encoding.data.length * barWidth + quietZone * 2;
  const totalHeight = barHeight;
  const path = buildBarcodePath(encoding.data, barWidth, barHeight);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <g transform="translate(${quietZone} 0)" fill="#111827">
        <path d="${path}" />
      </g>
    </svg>
  `.trim();

  barcodeCache.set(normalized, svg);
  return svg;
}

export function getQrSvgMarkup(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  const cached = qrCache.get(normalized);
  if (cached) {
    return cached;
  }

  const qr = QRCode.create(normalized, { errorCorrectionLevel: "M" });
  const moduleCount = qr.modules.size;
  const quietZone = 4;
  const size = moduleCount + quietZone * 2;
  let path = "";

  for (let row = 0; row < moduleCount; row += 1) {
    for (let column = 0; column < moduleCount; column += 1) {
      const isDark = qr.modules.get(column, row);

      if (!isDark) {
        continue;
      }

      const x = column + quietZone;
      const y = row + quietZone;
      path += `M${x} ${y}h1v1H${x}z`;
    }
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <rect width="100%" height="100%" fill="#ffffff"/>
      <path d="${path}" fill="#111827" />
    </svg>
  `.trim();

  qrCache.set(normalized, svg);
  return svg;
}
