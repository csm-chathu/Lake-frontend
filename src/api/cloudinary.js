const CLOUD_NAME = 'dtnexo7rx';
const UPLOAD_PRESET = 'food-restaurant';
const DEFAULT_FOLDER = 'vet-diagnostics';
const MAX_IMAGE_DIMENSION = 1600;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB threshold before forcing recompression
const JPEG_QUALITY = 0.82;

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

const ensureConfig = () => {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Missing Cloudinary configuration. Please set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.');
  }
};

const loadImageFromFile = (file) => {
  if (!isBrowser) {
    return Promise.reject(new Error('Image optimization requires browser APIs.'));
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = (event) => {
      URL.revokeObjectURL(objectUrl);
      reject(event?.error || new Error('Failed to load image for resizing.'));
    };
    image.src = objectUrl;
  });
};

const maybeOptimizeImageFile = async (file) => {
  if (!isBrowser || !(file instanceof File)) {
    return file;
  }

  if (!file.type || !file.type.startsWith('image/')) {
    return file;
  }

  try {
    const image = await loadImageFromFile(file);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) {
      return file;
    }

    const largestSide = Math.max(width, height);
    const shouldResize = largestSide > MAX_IMAGE_DIMENSION || file.size > MAX_IMAGE_BYTES;
    if (!shouldResize) {
      return file;
    }

    const scale = Math.min(MAX_IMAGE_DIMENSION / largestSide, 1);
    const targetWidth = Math.max(Math.round(width * scale), 1);
    const targetHeight = Math.max(Math.round(height * scale), 1);

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      return file;
    }

    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const prefersLossless = file.type === 'image/png' || file.type === 'image/webp';
    const targetMime = prefersLossless ? file.type : 'image/jpeg';
    const quality = targetMime === 'image/jpeg' ? JPEG_QUALITY : undefined;

    const resizedBlob = await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to compress image.'));
        }
      }, targetMime, quality);
    });

    return new File([resizedBlob], file.name, { type: targetMime, lastModified: Date.now() });
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.warn('Image optimization skipped:', error);
    }
    return file;
  }
};

export async function uploadReportToCloudinary(file, { folder = DEFAULT_FOLDER } = {}) {
  ensureConfig();
  if (!(file instanceof File)) {
    throw new Error('A valid file is required to upload diagnostics.');
  }

  const fileToUpload = await maybeOptimizeImageFile(file);

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;
  const formData = new FormData();
  formData.append('file', fileToUpload);
  formData.append('upload_preset', UPLOAD_PRESET);
  if (folder) {
    formData.append('folder', folder);
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || 'Report upload failed';
    throw new Error(message);
  }

  return payload;
}

export function isCloudinaryConfigured() {
  return Boolean(CLOUD_NAME && UPLOAD_PRESET);
}
