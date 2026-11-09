const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const SCALE = 2;
const PAPER = '#faf6ec';
const INK = '#253f34';
const MUTED_INK = '#546659';
const BORDER = '#e3d9c7';
const HONEY = '#f4cc72';
const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = 'Arial, Helvetica, sans-serif';
const dateFormat = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'long',
  timeZone: 'UTC',
});

function write(ctx, text, x, y, { font, color = INK, align = 'left', width }) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  if (width) {
    ctx.fillText(text, x, y, width);
  } else {
    ctx.fillText(text, x, y);
  }
}

function wrapText(ctx, text, width) {
  const words = text.trim().split(/\s+/).flatMap((word) => {
    if (ctx.measureText(word).width <= width) return [word];

    // Wrap a long unbroken string, for example a name written without spaces.
    const chunks = [];
    let chunk = '';
    for (const character of word) {
      if (chunk && ctx.measureText(chunk + character).width > width) {
        chunks.push(chunk);
        chunk = '';
      }
      chunk += character;
    }
    return [...chunks, chunk];
  });
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? line + ' ' + word : word;
    if (line && ctx.measureText(candidate).width > width) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function writeParagraph(ctx, text, x, y, {
  family, size, minimumSize = size, lineHeight, maxLines, ...style
}) {
  let fontSize = size;
  ctx.font = fontSize + 'px ' + family;
  let lines = wrapText(ctx, text, style.width);
  while (lines.length > maxLines && fontSize > minimumSize) {
    fontSize = Math.max(minimumSize, fontSize - 2);
    ctx.font = fontSize + 'px ' + family;
    lines = wrapText(ctx, text, style.width);
  }
  const font = ctx.font;
  const spacing = lineHeight * fontSize / size;
  const visibleLines = lines.slice(0, maxLines);
  if (lines.length > maxLines) visibleLines[maxLines - 1] += '…';
  visibleLines.forEach((content, index) => {
    write(ctx, content, x, y + index * spacing, { ...style, font });
  });
  return y + Math.max(0, visibleLines.length - 1) * spacing;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Ein Foto konnte nicht geöffnet werden.'));
    image.src = src;
  });
}

function makePage() {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_WIDTH * SCALE;
  canvas.height = PAGE_HEIGHT * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  return { canvas, ctx };
}

function imageFrame(ctx, image, x, y, width, height) {
  ctx.fillStyle = '#fffcf5';
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 5);
  ctx.fill();
  ctx.stroke();

  const inset = 15;
  const scale = Math.min(
    (width - inset * 2) / image.naturalWidth,
    (height - inset * 2) / image.naturalHeight,
  );
  const imageWidth = image.naturalWidth * scale;
  const imageHeight = image.naturalHeight * scale;
  ctx.drawImage(
    image,
    x + (width - imageWidth) / 2,
    y + (height - imageHeight) / 2,
    imageWidth,
    imageHeight,
  );
}

function footer(ctx, pageNumber) {
  ctx.strokeStyle = BORDER;
  ctx.beginPath();
  ctx.moveTo(52, 782);
  ctx.lineTo(PAGE_WIDTH - 52, 782);
  ctx.stroke();
  write(ctx, 'LITTLE KEEPS', 52, 808, {
    font: '700 10px ' + SANS,
    color: MUTED_INK,
  });
  write(ctx, String(pageNumber).padStart(2, '0'), PAGE_WIDTH - 52, 808, {
    font: '500 10px ' + SANS,
    align: 'right',
    color: MUTED_INK,
  });
}

function paintCover(ctx, title, childName, count, image) {
  const center = PAGE_WIDTH / 2;

  ctx.fillStyle = HONEY;
  ctx.beginPath();
  ctx.arc(center, 88, 23, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(center, 77);
  ctx.quadraticCurveTo(center + 2, 86, center + 11, 88);
  ctx.quadraticCurveTo(center + 2, 90, center, 99);
  ctx.quadraticCurveTo(center - 2, 90, center - 11, 88);
  ctx.quadraticCurveTo(center - 2, 86, center, 77);
  ctx.fill();

  write(ctx, 'EIN ALBUM VON LITTLE KEEPS', center, 133, {
    font: '700 11px ' + SANS,
    align: 'center',
    color: MUTED_INK,
  });
  const titleBottom = writeParagraph(ctx, title, center, 211, {
    family: SERIF,
    size: 58,
    minimumSize: 24,
    width: 480,
    align: 'center',
    lineHeight: 62,
    maxLines: 2,
  });
  const summary = count + (count === 1 ? ' Erinnerung' : ' Erinnerungen');
  const coverSubtitle = childName ? childName + ' · ' + summary : summary;
  const subtitleY = titleBottom + 38;
  write(ctx, coverSubtitle, center, subtitleY, {
    font: '500 15px ' + SANS,
    width: 480,
    align: 'center',
    color: MUTED_INK,
  });

  write(ctx, 'Dietzgen-Strolche · Große Strolche', center, subtitleY + 22, {
    font: '500 12px ' + SANS,
    align: 'center',
    color: MUTED_INK,
  });

  const imageTop = subtitleY + 61;
  imageFrame(ctx, image, 75, imageTop, PAGE_WIDTH - 150, 730 - imageTop);
  footer(ctx, 1);
}

function paintArtwork(ctx, work, image, index) {
  const x = 52;
  const width = PAGE_WIDTH - x * 2;
  const date = new Date(work.date + 'T00:00:00Z');
  const sequence = 'ERINNERUNG ' + String(index + 1).padStart(2, '0');
  write(ctx, sequence, x, 76, { font: '700 11px ' + SANS });
  if (Number.isFinite(date.getTime())) {
    write(ctx, dateFormat.format(date), PAGE_WIDTH - x, 76, {
      font: '500 12px ' + SANS,
      align: 'right',
      color: MUTED_INK,
    });
  }
  imageFrame(ctx, image, x, 99, width, 476);

  const titleBottom = writeParagraph(ctx, work.title, x, 626, {
    family: SERIF,
    size: 36,
    minimumSize: 20,
    width,
    lineHeight: 39,
    maxLines: 2,
  });
  if (work.note?.trim()) {
    writeParagraph(ctx, work.note, x, titleBottom + 32, {
      family: SANS,
      size: 15,
      minimumSize: 12,
      color: MUTED_INK,
      width,
      lineHeight: 18,
      maxLines: 5,
    });
  }
  footer(ctx, index + 2);
}

function encodePage(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      // Free the pixel buffer before rendering another page.
      canvas.width = 0;
      canvas.height = 0;
      if (blob) resolve(blob);
      else reject(new Error('Eine Albumseite konnte nicht erstellt werden.'));
    }, 'image/jpeg', 0.92);
  });
}

function makePdf(pageImages) {
  const encoder = new TextEncoder();
  const parts = [];
  const offsets = [0];
  let bytes = 0;

  function append(part) {
    const data = typeof part === 'string' ? encoder.encode(part) : part;
    parts.push(data);
    bytes += data instanceof Blob ? data.size : data.byteLength;
  }

  function object(...data) {
    const id = offsets.length;
    offsets.push(bytes);
    append(id + ' 0 obj\n');
    data.forEach(append);
    append('\nendobj\n');
  }

  append('%PDF-1.4\n');
  append(new Uint8Array([37, 226, 227, 207, 211, 10]));
  const children = pageImages.map((_, index) => (3 + 3 * index) + ' 0 R');
  object('<< /Type /Catalog /Pages 2 0 R /Lang (de-DE) >>');
  object('<< /Type /Pages /Count ' + children.length + ' /Kids [' + children.join(' ') + '] >>');

  // Each rendered page is a single JPEG image with its own PDF drawing stream.
  for (const image of pageImages) {
    const pageId = offsets.length;
    object('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PAGE_WIDTH + ' ' + PAGE_HEIGHT +
      '] /Resources << /XObject << /Art ' + (pageId + 2) + ' 0 R >> >> /Contents ' +
      (pageId + 1) + ' 0 R >>');
    const drawing = 'q\n' + PAGE_WIDTH + ' 0 0 ' + PAGE_HEIGHT + ' 0 0 cm\n/Art Do\nQ\n';
    object('<< /Length ' + drawing.length + ' >>\nstream\n', drawing, 'endstream');
    object('<< /Type /XObject /Subtype /Image /ColorSpace /DeviceRGB /BitsPerComponent 8' +
      ' /Width ' + PAGE_WIDTH * SCALE + ' /Height ' + PAGE_HEIGHT * SCALE +
      ' /Filter /DCTDecode /Length ' + image.size + ' >>\nstream\n', image, '\nendstream');
  }

  const xref = bytes;
  append('xref\n0 ' + offsets.length + '\n0000000000 65535 f \n');
  for (const offset of offsets.slice(1)) {
    append(String(offset).padStart(10, '0') + ' 00000 n \n');
  }
  append('trailer\n<< /Size ' + offsets.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
  return new Blob(parts, { type: 'application/pdf' });
}

export async function downloadAlbum({ title, childName, artwork }) {
  if (!artwork.length) throw new Error('Wähle mindestens ein Kunstwerk für dein Album aus.');

  const albumTitle = title.trim() || 'Meine kleinen Kunstwerke';
  const pages = [];
  for (const [index, work] of artwork.entries()) {
    const image = await loadImage(work.image);
    if (index === 0) {
      const cover = makePage();
      paintCover(cover.ctx, albumTitle, childName, artwork.length, image);
      pages.push(await encodePage(cover.canvas));
    }
    const page = makePage();
    paintArtwork(page.ctx, work, image, index);
    pages.push(await encodePage(page.canvas));
  }

  const filename = albumTitle.replace(/[^\p{L}\p{N}\p{M}]+/gu, '-').replace(/^-+|-+$/g, '');
  const url = URL.createObjectURL(makePdf(pages));
  const download = document.createElement('a');
  download.href = url;
  download.download = (filename || 'Little-Keeps-Album') + '.pdf';
  document.body.append(download);
  download.click();
  download.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
