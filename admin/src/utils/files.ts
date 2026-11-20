export const MAX_ATTACHMENT_SIZE_MB = 10;
export const MAX_ATTACHMENT_SIZE = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;
export const DEFAULT_MIME_TYPE = 'application/octet-stream';

const IMAGE_EXTENSIONS = ['.apng', '.avif', '.gif', '.jpg', '.jpeg', '.png', '.webp'];

export const isImageName = (name: string): boolean => {
  const lower = name.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
};

export const isImageFile = (file: File): boolean =>
  file.type.startsWith('image/') || isImageName(file.name);

/** Đọc file thành chuỗi base64 thuần (bỏ prefix `data:*\/*;base64,`). */
export const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.split(',')[1] || result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Không thể đọc file đính kèm'));
    reader.readAsDataURL(file);
  });

export const formatFileSize = (size?: number): string => {
  if (!size) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const getDriveFileId = (url: string): string | undefined =>
  url.match(/\/file\/d\/([^/]+)/)?.[1] ?? url.match(/[?&]id=([^&]+)/)?.[1];

/** URL hiển thị ảnh: link Google Drive được đổi sang link thumbnail. */
export const getDisplayURL = (url: string): string => {
  if (!url || url.startsWith('blob:')) return url;
  const driveFileId = url.match(/\/file\/d\/([^/]+)/)?.[1];
  return driveFileId ? `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w1000` : url;
};

/** URL tải file: link Google Drive được đổi sang link download trực tiếp. */
export const getDownloadURL = (url: string): string => {
  if (!url) return url;
  const driveFileId = getDriveFileId(url);
  return driveFileId ? `https://drive.google.com/uc?export=download&id=${driveFileId}` : url;
};
