import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BatchBar } from "@/components/studio/BatchBar";
import { DownloadPanel } from "@/components/studio/DownloadPanel";
import { EnhancePanel } from "@/components/studio/EnhancePanel";
import { PhotoEditor } from "@/components/studio/PhotoEditor";
import { PreviewPanel } from "@/components/studio/PreviewPanel";
import { SizePanel } from "@/components/studio/SizePanel";
import { UploadPanel } from "@/components/studio/UploadPanel";

// TEMPORARY visual QA route — removed after checks.
export const Route = createFileRoute("/qa-studio")({ ssr: false, component: QA });
function QA() {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="mx-auto grid max-w-5xl gap-4 p-3">
      <BatchBar />
      <div id="upload"><UploadPanel onEdit={setEditing} /></div>
      <div id="enhance"><EnhancePanel /></div>
      <div id="size"><SizePanel /></div>
      <div id="preview"><PreviewPanel /></div>
      <div id="download"><DownloadPanel /></div>
      <PhotoEditor id={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
