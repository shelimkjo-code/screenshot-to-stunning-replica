/** Physical print layout engine. All positions and sizes are millimetres. */
export const A4 = { widthMm: 210, heightMm: 297 } as const;
export const PRINT_DPI = 300;

export function mmToPx(mm: number, dpi = PRINT_DPI): number {
  return Math.round((mm / 25.4) * dpi);
}

export interface LayoutInput {
  photoWidthMm: number;
  photoHeightMm: number;
  marginMm: number;
  gapMm: number;
  /** One entry per source photo, in order, with its copy count. */
  items: { id: string; copies: number }[];
  pageWidthMm?: number;
  pageHeightMm?: number;
}

export interface PlacedPhoto {
  id: string;
  copyIndex: number;
  page: number;
  row: number;
  col: number;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

export interface LayoutResult {
  columns: number;
  rows: number;
  perPage: number;
  pageCount: number;
  totalCopies: number;
  placements: PlacedPhoto[];
  pages: PlacedPhoto[][];
  offsetXMm: number;
  offsetYMm: number;
  fits: boolean;
}

/** How many cells of `size` fit in `available` with `gap` between neighbours. */
export function fitCount(available: number, size: number, gap: number): number {
  if (size <= 0) return 0;
  const n = Math.floor((available + gap + 1e-9) / (size + gap));
  return Math.max(0, n);
}

export function computeLayout(input: LayoutInput): LayoutResult {
  const pageW = input.pageWidthMm ?? A4.widthMm;
  const pageH = input.pageHeightMm ?? A4.heightMm;
  const w = input.photoWidthMm;
  const h = input.photoHeightMm;
  const m = Math.max(0, input.marginMm);
  const g = Math.max(0, input.gapMm);

  const columns = fitCount(pageW - 2 * m, w, g);
  const rows = fitCount(pageH - 2 * m, h, g);
  const perPage = columns * rows;
  const totalCopies = input.items.reduce((s, i) => s + Math.max(0, Math.floor(i.copies)), 0);

  // Centre the grid horizontally so the cut margins are even; start at the top margin.
  const gridW = columns > 0 ? columns * w + (columns - 1) * g : 0;
  const offsetXMm = columns > 0 ? (pageW - gridW) / 2 : m;
  const offsetYMm = m;

  if (perPage === 0) {
    return { columns, rows, perPage, pageCount: 0, totalCopies, placements: [], pages: [], offsetXMm, offsetYMm, fits: false };
  }

  const placements: PlacedPhoto[] = [];
  let slot = 0;
  for (const item of input.items) {
    const copies = Math.max(0, Math.floor(item.copies));
    for (let c = 0; c < copies; c++) {
      const page = Math.floor(slot / perPage);
      const inPage = slot % perPage;
      const row = Math.floor(inPage / columns);
      const col = inPage % columns;
      placements.push({
        id: item.id,
        copyIndex: c,
        page,
        row,
        col,
        xMm: round3(offsetXMm + col * (w + g)),
        yMm: round3(offsetYMm + row * (h + g)),
        widthMm: w,
        heightMm: h,
      });
      slot++;
    }
  }
  const pageCount = Math.ceil(slot / perPage);
  const pages: PlacedPhoto[][] = Array.from({ length: pageCount }, () => []);
  for (const p of placements) pages[p.page]!.push(p);

  return { columns, rows, perPage, pageCount, totalCopies, placements, pages, offsetXMm, offsetYMm, fits: true };
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

export const SIZE_PRESETS = {
  passport: { widthMm: 40, heightMm: 50 },
  stamp: { widthMm: 25, heightMm: 35 },
} as const;

export const COPY_OPTIONS = [1, 2, 4, 6, 8, 10] as const;
export const DEFAULT_COPIES = 2;
export const DEFAULT_MARGIN_MM = 3;
export const DEFAULT_GAP_MM = 1;
