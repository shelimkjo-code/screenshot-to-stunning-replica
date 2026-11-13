import { Eraser, Move, RotateCcw, RotateCw, Sparkles, Undo2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n, type TKey } from "@/lib/i18n";
import { DEFAULT_EDITS, type Edits, type Rotation } from "@/lib/studio/imaging";
import { reprocess, scheduleSave } from "@/lib/studio/processor";
import { usePreviewUrl } from "@/lib/studio/use-preview";
import { useStudio } from "@/lib/studio/store";
import { BeforeAfter } from "./BeforeAfter";
import { ColorSwatches } from "./common";

export function PhotoEditor({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t } = useI18n();
  const photo = useStudio((s) => s.photos.find((p) => p.id === id));
  const settings = useStudio((s) => s.settings);
  const url = usePreviewUrl(photo?.stage === "done" ? photo : undefined, settings, "final", 160);
  const frame = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const [tab, setTab] = useState("edit");

  if (!photo) return null;
  const e = photo.edits;
  const setEdits = (patch: Partial<Edits>) => {
    useStudio.getState().updatePhoto(photo.id, { edits: { ...photo.edits, ...patch } });
    scheduleSave(photo.id);
  };
  const rotate = (dir: 1 | -1) => setEdits({ rotation: (((e.rotation + dir * 90) % 360) + 360) % 360 as Rotation, offsetX: 0, offsetY: 0 });

  function onDown(ev: React.PointerEvent) {
    (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
    drag.current = { x: ev.clientX, y: ev.clientY, dx: 0, dy: 0 };
  }
  function onMove(ev: React.PointerEvent) {
    if (!drag.current || !img.current) return;
    drag.current.dx = ev.clientX - drag.current.x;
    drag.current.dy = ev.clientY - drag.current.y;
    img.current.style.transform = `translate(${drag.current.dx}px, ${drag.current.dy}px)`;
  }
  function onUp() {
    const d = drag.current;
    drag.current = null;
    if (!d || !frame.current) return;
    const r = frame.current.getBoundingClientRect();
    if (Math.abs(d.dx) + Math.abs(d.dy) > 1) {
      setEdits({ offsetX: clamp(e.offsetX + (d.dx / r.width) * 100, -60, 60), offsetY: clamp(e.offsetY + (d.dy / r.height) * 100, -60, 60) });
    }
    requestAnimationFrame(() => {
      if (img.current) img.current.style.transform = "";
    });
  }

  const sliders: { key: keyof Edits; label: TKey; min: number; max: number; step: number }[] = [
    { key: "zoom", label: "zoomLabel", min: 0.5, max: 2.5, step: 0.01 },
    { key: "tilt", label: "tilt", min: -15, max: 15, step: 0.5 },
    { key: "offsetX", label: "moveX", min: -60, max: 60, step: 0.5 },
    { key: "offsetY", label: "moveY", min: -60, max: 60, step: 0.5 },
    { key: "brightness", label: "brightness", min: -50, max: 50, step: 1 },
    { key: "contrast", label: "contrast", min: -50, max: 50, step: 1 },
    { key: "saturation", label: "saturation", min: -100, max: 100, step: 1 },
    { key: "sharpness", label: "sharpness", min: 0, max: 100, step: 1 },
  ];

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[94vh] max-w-4xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{t("editPhoto")} · {photo.fileName}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-5 md:grid-cols-[minmax(0,320px)_1fr]">
          <div>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="mb-3 grid w-full grid-cols-2">
                <TabsTrigger value="edit"><Move className="mr-1 size-4" />{t("edit")}</TabsTrigger>
                <TabsTrigger value="compare">{t("beforeAfter")}</TabsTrigger>
              </TabsList>
              <TabsContent value="edit">
                <div
                  ref={frame}
                  className="relative mx-auto w-full max-w-[320px] cursor-grab touch-none overflow-hidden rounded-lg border shadow-sheet checker active:cursor-grabbing"
                  style={{ aspectRatio: `${settings.widthMm} / ${settings.heightMm}` }}
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onUp}
                >
                  {url && <img ref={img} src={url} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" />}
                  {/* head-position guide */}
                  <div className="pointer-events-none absolute inset-x-[18%] top-[10%] h-[60%] rounded-[50%] border border-dashed border-primary-foreground/70" />
                </div>
                <p className="mt-2 text-center text-xs text-muted-foreground">{t("dragHint")}</p>
              </TabsContent>
              <TabsContent value="compare">
                <BeforeAfter photo={photo} dpi={160} />
              </TabsContent>
            </Tabs>
          </div>
          <div className="grid content-start gap-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => rotate(-1)}><RotateCcw />{t("rotateLeft")}</Button>
              <Button variant="outline" size="sm" onClick={() => rotate(1)}><RotateCw />{t("rotateRight")}</Button>
              <Button variant="ghost" size="sm" onClick={() => setEdits({ ...DEFAULT_EDITS })}><Undo2 />{t("reset")}</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {sliders.map((s) => (
                <div key={s.key} className="grid gap-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{t(s.label)}</span>
                    <span className="font-mono text-muted-foreground">{Number(e[s.key]).toFixed(s.step < 1 ? (s.step < 0.1 ? 2 : 1) : 0)}</span>
                  </div>
                  <Slider min={s.min} max={s.max} step={s.step} value={[Number(e[s.key])]} onValueChange={([v]) => setEdits({ [s.key]: v } as Partial<Edits>)} />
                </div>
              ))}
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold">{t("bgColor")}</p>
              <ColorSwatches value={e.bgColor ?? settings.bgColor} onChange={(c) => setEdits({ bgColor: c })} />
              {e.bgColor && (
                <button className="mt-2 text-xs text-primary hover:underline" onClick={() => setEdits({ bgColor: null })}>{t("useBatchColour")}</button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button variant="soft" size="sm" onClick={() => { reprocess([photo.id], "bg"); onClose(); }}><Eraser />{t("reprocessBg")}</Button>
              <Button variant="soft" size="sm" onClick={() => { reprocess([photo.id], "enhance"); onClose(); }}><Sparkles />{t("reprocessEnhance")}</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function clamp(v: number, a: number, b: number) {
  return Math.min(b, Math.max(a, v));
}
