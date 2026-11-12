/** Built-in background removal that runs in the browser (MODNet portrait matting). */
import { canvasToBlob, makeCanvas } from "./imaging";

type Loaded = { model: any; processor: any; RawImage: any };
let loading: Promise<Loaded> | null = null;

function load(): Promise<Loaded> {
  if (!loading) {
    loading = (async () => {
      const t: any = await import("@huggingface/transformers");
      t.env.allowLocalModels = false;
      const [model, processor] = await Promise.all([
        t.AutoModel.from_pretrained("Xenova/modnet", { dtype: "fp32" }),
        t.AutoProcessor.from_pretrained("Xenova/modnet"),
      ]);
      return { model, processor, RawImage: t.RawImage };
    })().catch((e) => {
      loading = null;
      throw e;
    });
  }
  return loading;
}

export async function removeBackgroundLocal(blob: Blob): Promise<Blob> {
  const { model, processor, RawImage } = await load();
  const url = URL.createObjectURL(blob);
  try {
    const image = await RawImage.fromURL(url);
    const { pixel_values } = await processor(image);
    const { output } = await model({ input: pixel_values });
    const mask = await RawImage.fromTensor(output[0].mul(255).to("uint8")).resize(image.width, image.height);
    const bmp = await createImageBitmap(blob);
    const c = makeCanvas(bmp.width, bmp.height);
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(bmp, 0, 0);
    const px = ctx.getImageData(0, 0, c.width, c.height);
    const m: Uint8Array = mask.data;
    const ch = mask.channels ?? 1;
    for (let i = 0; i < c.width * c.height; i++) px.data[i * 4 + 3] = m[i * ch]!;
    ctx.putImageData(px, 0, 0);
    return await canvasToBlob(c, "image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
