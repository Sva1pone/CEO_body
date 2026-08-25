export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(IMAGE_ACCEPT.split(","));

export function imageFileError(file) {
  if (!file) return "Выбери изображение.";
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    return "Фото должно быть PNG, JPG, WEBP или GIF.";
  }
  if (file.size > MAX_IMAGE_BYTES) return "Фото не должно превышать 8 МБ.";
  return "";
}
