import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { scheduleSave, scheduleSettingsSave } from "@/lib/studio/processor";
import { usePreviewUrl } from "@/lib/studio/use-preview";
import { useStudio, type PhotoItem } from "@/lib/studio/store";
import { CopiesPicker, Panel, StageBadge } from "./common";

function Row({ p }: { p: PhotoItem }) {
  const settings = useStudio((s) => s.settings);
  const url = usePreviewUrl(p.stage === "done" ? p : undefined, settings, "final", 60);
  return (
    <li className="flex flex-wrap items-center gap-3 py-2.5">
      <span className="w-10 shrink-0 overflow-hidden rounded border checker" style={{ aspectRatio: `${settings.widthMm}/${settings.heightMm}` }}>
        {url && <img src={url} alt="" className="h-full w-full object-cover" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{p.fileName}</span>
        <StageBadge stage={p.stage} />
      </span>
      <CopiesPicker
        size="sm"
        value={p.copies}
        onChange={(c) => {
          useStudio.getState().updatePhoto(p.id, { copies: c });
          scheduleSave(p.id);
        }}
      />
    </li>
  );
}

export function CopiesPanel() {
  const { t } = useI18n();
  const settings = useStudio((s) => s.settings);
  const photos = useStudio((s) => s.photos);
  return (
    <Panel title={t("stepCopies")} icon={<Copy className="size-5" />}>
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-secondary/50 p-3">
        <div>
          <p className="mb-1.5 text-sm font-semibold">{t("defaultCopies")}</p>
          <CopiesPicker
            value={settings.defaultCopies}
            onChange={(c) => {
              useStudio.getState().setSettings({ defaultCopies: c });
              scheduleSettingsSave();
            }}
          />
        </div>
        <Button
          variant="outline"
          disabled={!photos.length}
          onClick={() => {
            for (const p of useStudio.getState().photos) {
              useStudio.getState().updatePhoto(p.id, { copies: settings.defaultCopies });
              scheduleSave(p.id);
            }
          }}
        >
          {t("applyAll")}
        </Button>
      </div>
      {photos.length ? (
        <ul className="mt-4 divide-y">{photos.map((p) => <Row key={p.id} p={p} />)}</ul>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">{t("noPhotos")}</p>
      )}
    </Panel>
  );
}
