/**
 * Tactical Image Compressor
 * Downscales images to max 800px width/height and compresses to WebP/JPEG <= 150KB
 * Prevents buffer exhaustion on air-gapped tactical WebSocket transports.
 */

export interface CompressedImageResult {
  base64: string;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: string;
}

export async function compressTacticalImage(file: File): Promise<CompressedImageResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        const MAX_DIMENSION = 800;

        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Canvas context initialization failed'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP at 0.7 quality first
        let quality = 0.7;
        let mimeType = 'image/webp';
        let dataUrl = canvas.toDataURL(mimeType, quality);

        // Fallback to JPEG if browser doesn't support WebP export
        if (!dataUrl.startsWith('data:image/webp')) {
          mimeType = 'image/jpeg';
          dataUrl = canvas.toDataURL(mimeType, quality);
        }

        // Check if size is within 150KB ceiling, reduce quality if needed
        let binaryLength = Math.round((dataUrl.length * 3) / 4);
        while (binaryLength > 150 * 1024 && quality > 0.3) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL(mimeType, quality);
          binaryLength = Math.round((dataUrl.length * 3) / 4);
        }

        resolve({
          base64: dataUrl,
          width,
          height,
          sizeBytes: binaryLength,
          mimeType
        });
      };

      img.onerror = () => reject(new Error('Failed to decode image data'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}
