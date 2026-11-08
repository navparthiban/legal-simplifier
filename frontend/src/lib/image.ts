import { UserError } from './errors';

/** Image → base64 data URL, ported from index.html `encodeImageBase64`. */
export function encodeImageBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string); // data URL
    reader.onerror = () => reject(new UserError('err-image-read'));
    reader.readAsDataURL(file);
  });
}
