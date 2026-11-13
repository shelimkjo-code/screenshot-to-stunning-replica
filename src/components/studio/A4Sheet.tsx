import { A4, type PlacedPhoto } from "@/lib/studio/layout";

export function A4Sheet({ page, urls, zoom, showLabel, label }: { page: PlacedPhoto[]; urls: Record<string, string>; zoom: number; showLabel?: boolean; label?: string }) {
  return (
    <div className="relative mx-auto" style={{ width: `calc(min(560px, 100%) * ${zoom})` }}>
      <div className="mb-1 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
        <span className="h-px flex-1 bg-muted-foreground/40" />210 mm<span className="h-px flex-1 bg-muted-foreground/40" />
      </div>
      <div className="relative w-full bg-paper shadow-sheet" style={{ aspectRatio: `${A4.widthMm} / ${A4.heightMm}` }}>
        {page.map((p, i) => (
          <div
            key={`${p.id}-${p.copyIndex}`}
            className="absolute overflow-hidden bg-muted outline outline-[0.5px] outline-border"
            style={{
              left: `${(p.xMm / A4.widthMm) * 100}%`,
              top: `${(p.yMm / A4.heightMm) * 100}%`,
              width: `${(p.widthMm / A4.widthMm) * 100}%`,
              height: `${(p.heightMm / A4.heightMm) * 100}%`,
            }}
          >
            {urls[p.id] && <img src={urls[p.id]} alt="" className="h-full w-full object-cover" draggable={false} />}
            {showLabel && i === 0 && label && (
              <span className="absolute bottom-0.5 left-0.5 rounded bg-foreground/75 px-1 font-mono text-[9px] text-background">{label}</span>
            )}
          </div>
        ))}
        <span className="absolute -right-5 top-1/2 origin-center -translate-y-1/2 rotate-90 whitespace-nowrap font-mono text-[10px] text-muted-foreground">297 mm</span>
      </div>
    </div>
  );
}
