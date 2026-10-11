// Photos taken in the app (tag of a lot, a problem on the floor). Phone
// cameras give 3–10 MB pictures; they are shrunk to at most 1280 px as JPEG
// (usually 150–400 KB) before they are kept or sent, so a weak network and
// Dataverse's 5 MB attachment limit are not a problem.

export interface Photo {
  /** JPEG bytes as base64, without the data: prefix (what a Dataverse Note stores). */
  base64: string;
  mime: string;
  name: string;
  /** data: URL for the thumbnail on screen. */
  preview: string;
}

const MAX_SIDE = 1280;
const QUALITY = 0.72;

async function decode(file: File): Promise<{ draw: CanvasImageSource; w: number; h: number }> {
  if ("createImageBitmap" in window) {
    // from-image: phones store the camera's rotation in EXIF.
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { draw: bmp, w: bmp.width, h: bmp.height };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { draw: img, w: img.naturalWidth, h: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Reads a picked or captured image and returns it shrunk, as JPEG. */
export async function readPhoto(file: File, name: string): Promise<Photo> {
  if (!file.type.startsWith("image/")) throw new Error("That file isn't a picture.");
  const { draw, w, h } = await decode(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d")!.drawImage(draw, 0, 0, canvas.width, canvas.height);
  const preview = canvas.toDataURL("image/jpeg", QUALITY);
  return { base64: preview.slice(preview.indexOf(",") + 1), mime: "image/jpeg", name: `${name}.jpg`, preview };
}

/** Size of a photo's bytes, for the on-screen note. */
export const photoKb = (p: Photo) => Math.round((p.base64.length * 3) / 4 / 1024);
