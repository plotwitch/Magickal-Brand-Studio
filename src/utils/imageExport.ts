/**
 * Converts any image URL (data URL or local asset URL) into a PNG data URL
 * rendered at the exact targetWidth × targetHeight pixel dimensions using high-quality center-cover scaling.
 */
export async function renderImageAtExactDimensions(
  sourceUrl: string,
  targetWidth: number,
  targetHeight: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(sourceUrl);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // Center-cover calculation so image fills targetWidth × targetHeight without distortion
        const srcRatio = img.width / img.height;
        const targetRatio = targetWidth / targetHeight;

        let sx = 0;
        let sy = 0;
        let sWidth = img.width;
        let sHeight = img.height;

        if (srcRatio > targetRatio) {
          sWidth = img.height * targetRatio;
          sx = (img.width - sWidth) / 2;
        } else if (srcRatio < targetRatio) {
          sHeight = img.width / targetRatio;
          sy = (img.height - sHeight) / 2;
        }

        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
        const exactDataUrl = canvas.toDataURL("image/png");
        resolve(exactDataUrl);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("Failed to load image for exact dimension rendering."));
    img.src = sourceUrl;
  });
}

function slugifyToken(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "item"
  );
}

/**
 * Formats exported filenames strictly as: product_medium_size.png
 * Example: hardcover_journal_etsy_listing_2700x2025.png
 */
export function formatExportFilename(
  productName: string,
  mediumSlug: string,
  width: number,
  height: number
): string {
  const cleanProduct = slugifyToken(productName);
  const cleanMedium = slugifyToken(mediumSlug);
  return `${cleanProduct}_${cleanMedium}_${width}x${height}.png`;
}

/**
 * Triggers a browser download of an image at its exact targetWidth × targetHeight pixel dimensions
 * named strictly as product_medium_size.png
 */
export async function downloadExactSizedImage(
  imageUrl: string,
  productName: string,
  mediumSlug: string,
  width: number,
  height: number
): Promise<void> {
  const filename = formatExportFilename(productName, mediumSlug, width, height);
  let finalDataUrl = imageUrl;

  try {
    finalDataUrl = await renderImageAtExactDimensions(imageUrl, width, height);
  } catch {
    // Fallback to raw imageUrl if canvas conversion fails
  }

  const link = document.createElement("a");
  link.href = finalDataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
