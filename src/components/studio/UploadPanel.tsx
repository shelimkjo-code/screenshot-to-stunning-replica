import { ImagePlus, Upload, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { combineJoint } from "@/lib/studio/joint";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { deletePhotoFiles, pump, retry, scheduleSave } from "@/lib/studio/processor";
import { forget } from "@/lib/studio/render-cache";
import { newPhotoItem, useStudio } from "@/lib/studio/store";
import { Panel } from "./common";
import { PhotoCard } from "./PhotoCard";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

export function UploadPanel({ onEdit }: { onEdit: (id: string) => void }) {
  const { t, n } = useI18n();
  const photos = useStudio((s) => s.photos);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const jointInput = useRef<HTMLInputElement>(null);

  async function addJoint(list: FileList) {
    const files = Array.from(list);
    if (files.length !== 2) {
      toast.error(t("jointNeedTwo"));
      return;
    }
    try {
      addFiles([await combineJoint(files[0]!, files[1]!)]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function addFiles(list: FileList | File[]) {
    const files = Array.from(list).filter((f) => ACCEPT.includes(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name));
    const skipped = Array.from(list).length - files.length;
    if (skipped > 0) toast.error(`${skipped} file(s) skipped — only JPG, PNG, WEBP`);
    if (!files.length) return;
    const st = useStudio.getState();
    const start = st.photos.length;
    st.addPhotos(files.map((f, i) => newPhotoItem(f, st.settings.defaultCopies, start + i)));
    pump();
  }

  async function remove(id: string) {
    const p = useStudio.getState().photos.find((x) => x.id === id);
    useStudio.getState().removePhoto(id);
    forget(id);
    if (p?.saved || p?.paths.original) await deletePhotoFiles(p).catch(() => undefined);
  }

  return (
    <Panel title={t("stepUpload")} icon={<Upload className="size-5" />}>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "bg-graph flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 text-center transition",
          photos.length ? "py-8" : "py-16",
          drag ? "border-primary bg-secondary" : "border-primary/30 hover:border-primary/60",
        )}
      >
        <span className="grid size-14 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
          <ImagePlus className="size-7" />
        </span>
        <span className="text-base font-semibold sm:text-lg">{photos.length ? t("addMore") : t("dropTitle")}</span>
        <span className="text-sm text-muted-foreground">{t("dropHint")}</span>
        <input
          ref={input}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      <div className="mt-3 flex flex-col items-center gap-1 text-center">
        <Button variant="outline" onClick={() => jointInput.current?.click()}><Users />{t("jointBtn")}</Button>
        <span className="text-xs text-muted-foreground">{t("jointHint")}</span>
        <input
          ref={jointInput}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) void addJoint(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {photos.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">{t("noPhotos")}</p>
      ) : (
        <>
          <p className="mb-3 mt-6 text-sm font-medium text-muted-foreground">{n(photos.length)} {t("photos")}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {photos.map((p) => (
              <PhotoCard
                key={p.id}
                photo={p}
                onEdit={() => onEdit(p.id)}
                onRemove={() => void remove(p.id)}
                onRetry={() => retry([p.id])}
                onCopies={(c) => {
                  useStudio.getState().updatePhoto(p.id, { copies: c });
                  scheduleSave(p.id);
                }}
              />
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}
