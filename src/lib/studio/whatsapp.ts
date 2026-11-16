import { create } from "zustand";

const KEY = "wa-number";

export const useWhatsApp = create<{ number: string; setNumber: (n: string) => void; load: () => void }>((set) => ({
  number: "",
  setNumber: (number) => {
    set({ number });
    try { localStorage.setItem(KEY, number); } catch { /* ignore */ }
  },
  load: () => {
    try { set({ number: localStorage.getItem(KEY) ?? "" }); } catch { /* ignore */ }
  },
}));

/** Bangladeshi local numbers (01XXXXXXXXX) become 8801XXXXXXXXX for wa.me. */
export function normalizeWaNumber(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("01") && d.length === 11) d = "88" + d;
  return d;
}

/** Shares the file directly on phones; otherwise downloads it and opens the customer's chat. */
export async function sendToWhatsApp(number: string, file: File, message: string, download: (b: Blob, n: string) => void) {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text: message });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  download(file, file.name);
  window.open(`https://wa.me/${normalizeWaNumber(number)}?text=${encodeURIComponent(message)}`, "_blank");
}
