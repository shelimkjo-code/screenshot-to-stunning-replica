import { describe, expect, it } from "vitest";
import { computeLayout, mmToPx, DEFAULT_COPIES, DEFAULT_GAP_MM, DEFAULT_MARGIN_MM, SIZE_PRESETS } from "./layout";

const passport = { photoWidthMm: 40, photoHeightMm: 50, marginMm: DEFAULT_MARGIN_MM, gapMm: DEFAULT_GAP_MM };

describe("A4 layout engine", () => {
  it("passport preset is 40mm x 50mm and stamp is 20mm x 25mm", () => {
    expect(SIZE_PRESETS.passport).toEqual({ widthMm: 40, heightMm: 50 });
    expect(SIZE_PRESETS.stamp).toEqual({ widthMm: 20, heightMm: 25 });
  });

  it("default copies per photo is 2", () => {
    expect(DEFAULT_COPIES).toBe(2);
  });

  it("fits 5 passport photos per row with default margins", () => {
    const r = computeLayout({ ...passport, items: [{ id: "a", copies: 2 }] });
    expect(r.columns).toBe(5);
  });

  it("starts a new row from the first column when a row is full", () => {
    const r = computeLayout({ ...passport, items: [{ id: "a", copies: 6 }] });
    expect(r.placements[5]).toMatchObject({ row: 1, col: 0 });
  });

  it("uses one page when everything fits and adds pages only when needed", () => {
    const one = computeLayout({ ...passport, items: [{ id: "a", copies: 2 }, { id: "b", copies: 2 }] });
    expect(one.pageCount).toBe(1);
    const perPage = one.perPage;
    const two = computeLayout({ ...passport, items: [{ id: "a", copies: perPage + 1 }] });
    expect(two.pageCount).toBe(2);
  });

  it("does not add filler duplicates beyond the requested copies", () => {
    const r = computeLayout({ ...passport, items: [{ id: "a", copies: 3 }] });
    expect(r.placements).toHaveLength(3);
  });

  it("keeps all copies of a photo contiguous", () => {
    const r = computeLayout({ ...passport, items: [{ id: "a", copies: 2 }, { id: "b", copies: 4 }] });
    expect(r.placements.map((p) => p.id).join("")).toBe("aabbbb");
  });

  it("places photos at exact millimetre positions with the gap between them", () => {
    const r = computeLayout({ ...passport, items: [{ id: "a", copies: 2 }] });
    const [p0, p1] = r.placements;
    expect(p1!.xMm - p0!.xMm).toBeCloseTo(41, 3);
    expect(p0!.widthMm).toBe(40);
    expect(p0!.heightMm).toBe(50);
  });

  it("keeps every photo inside the A4 sheet", () => {
    const r = computeLayout({ ...passport, items: [{ id: "a", copies: 60 }] });
    for (const p of r.placements) {
      expect(p.xMm + p.widthMm).toBeLessThanOrEqual(210);
      expect(p.yMm + p.heightMm).toBeLessThanOrEqual(297);
    }
  });

  it("converts millimetres to 300 DPI pixels (A4 = 2480 x 3508)", () => {
    expect(mmToPx(210)).toBe(2480);
    expect(mmToPx(297)).toBe(3508);
  });

  it("joint photo is 50mm wide x 40mm high", () => {
    expect(SIZE_PRESETS.joint).toEqual({ widthMm: 50, heightMm: 40 });
  });

  it("places joint photos at 50x40mm on their own row after single photos", () => {
    const r = computeLayout({
      ...passport,
      items: [
        { id: "a", copies: 2 },
        { id: "j", copies: 2, ...SIZE_PRESETS.joint },
      ],
    });
    const joint = r.placements.filter((p) => p.id === "j");
    expect(joint).toHaveLength(2);
    expect(joint[0]).toMatchObject({ widthMm: 50, heightMm: 40, row: 1, col: 0, yMm: 3 + 50 + 1 });
    expect(r.pageCount).toBe(1);
  });

  it("moves to a new page when mixed sizes run out of room", () => {
    const r = computeLayout({
      ...passport,
      items: [
        { id: "a", copies: 25 },
        { id: "j", copies: 1, ...SIZE_PRESETS.joint },
      ],
    });
    expect(r.placements.at(-1)).toMatchObject({ id: "j", page: 1, yMm: 3 });
    for (const p of r.placements) expect(p.yMm + p.heightMm).toBeLessThanOrEqual(297);
  });

  it("fits 99 stamp photos (20x25mm) on one A4 page", () => {
    const r = computeLayout({ photoWidthMm: 20, photoHeightMm: 25, marginMm: DEFAULT_MARGIN_MM, gapMm: DEFAULT_GAP_MM, items: [{ id: "s", copies: 99 }] });
    expect(r.pageCount).toBe(1);
    expect(r.perPage).toBe(99);
  });
});
