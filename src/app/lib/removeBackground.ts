// Xoá nền di ảnh và thay phông xanh ảnh thờ — chạy ngay trong trình duyệt (ảnh không gửi đi đâu).
// Mô hình: MODNet (tách chân dung người, giấy phép Apache-2.0) qua transformers.js.
// Thư viện được tải từ CDN khi cần (không đóng gói vào web) để không làm nặng bản build.

import { canvasToJpegFile } from './prepareImage';
import { personCrop } from './autoCrop';
import { PHOTO_WINDOW_ASPECT } from './frameLayout';

const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2';
const MODEL_ID = 'Xenova/modnet';
const MODEL_DTYPE = 'fp16';

// Phông xanh ảnh thờ: sáng ở giữa, đậm dần ra mép.
export const BLUE_BACKDROP = { inner: '#5B9BD8', outer: '#1D4F91' };

export type BgProgress = { stage: 'loading' | 'processing'; percent?: number };

/* eslint-disable @typescript-eslint/no-explicit-any */
type Loaded = { tf: any; model: any; processor: any };
let loading: Promise<Loaded> | null = null;

function loadModel(onProgress?: (p: BgProgress) => void): Promise<Loaded> {
    if (!loading) {
        loading = (async () => {
            const url = TRANSFORMERS_URL;
            const tf: any = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url);
            tf.env.allowLocalModels = false;

            const files: Record<string, { loaded: number; total: number }> = {};
            const progress_callback = (e: any) => {
                if (e?.status === 'progress' && e.file && e.total) {
                    files[e.file] = { loaded: e.loaded, total: e.total };
                    const all = Object.values(files);
                    const percent = Math.round((100 * all.reduce((s, f) => s + f.loaded, 0)) / all.reduce((s, f) => s + f.total, 0));
                    onProgress?.({ stage: 'loading', percent });
                }
            };

            const model = await tf.AutoModel.from_pretrained(MODEL_ID, { dtype: MODEL_DTYPE, device: 'wasm', progress_callback });
            const processor = await tf.AutoProcessor.from_pretrained(MODEL_ID);
            return { tf, model, processor };
        })().catch((err) => {
            loading = null; // cho phép thử lại lần sau
            throw err;
        });
    }
    return loading;
}

/** Tải sẵn bộ tách nền (gọi sớm để lúc chọn ảnh không phải chờ lâu). */
export function preloadBackgroundRemover(): void {
    loadModel().catch(() => { /* bỏ qua: sẽ thử lại khi dùng */ });
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Không đọc được ảnh')); };
        img.src = url;
    });
}

/**
 * Trả về ảnh JPEG đã xoá nền và thay phông xanh.
 * Ném lỗi nếu không tìm thấy người trong ảnh hoặc không chạy được mô hình.
 */
export async function replaceBackgroundWithBlue(photo: File, onProgress?: (p: BgProgress) => void): Promise<File> {
    const { tf, model, processor } = await loadModel(onProgress);
    onProgress?.({ stage: 'processing' });

    const image = await tf.RawImage.fromBlob(photo);
    const { pixel_values } = await processor(image);
    const { output } = await model({ input: pixel_values });
    const matte = await tf.RawImage.fromTensor(output[0].mul(255).to('uint8')).resize(image.width, image.height);
    const alpha: Uint8Array = matte.data;

    // Kiểm tra có tìm thấy người không (mặt nạ gần như trống = thất bại).
    let sum = 0;
    for (let i = 0; i < alpha.length; i += 16) sum += alpha[i];
    const coverage = sum / (alpha.length / 16) / 255;
    if (coverage < 0.05) throw new Error('Không nhận ra người trong ảnh');

    const img = await loadImage(photo);
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh');

    // Phông xanh
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.38, 0, w * 0.5, h * 0.38, Math.max(w, h) * 0.75);
    grad.addColorStop(0, BLUE_BACKDROP.inner);
    grad.addColorStop(1, BLUE_BACKDROP.outer);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    const bg = ctx.getImageData(0, 0, w, h);

    // Ảnh người
    ctx.drawImage(img, 0, 0, w, h);
    const fg = ctx.getImageData(0, 0, w, h);

    // Ghép: người * alpha + phông * (1 - alpha). Làm gọn rìa mờ để nền cũ không còn lấm tấm.
    const mw = matte.width;
    const sameSize = mw === w && matte.height === h;
    const out = fg.data;
    const back = bg.data;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const p = y * w + x;
            const raw = sameSize ? alpha[p] : alpha[Math.floor((y * matte.height) / h) * mw + Math.floor((x * mw) / w)];
            let a = (raw / 255 - 0.06) / 0.88;
            a = a < 0 ? 0 : a > 1 ? 1 : a;
            const i = p * 4;
            out[i] = out[i] * a + back[i] * (1 - a);
            out[i + 1] = out[i + 1] * a + back[i + 1] * (1 - a);
            out[i + 2] = out[i + 2] * a + back[i + 2] * (1 - a);
            out[i + 3] = 255;
        }
    }
    ctx.putImageData(fg, 0, 0);

    // Cắt quanh người theo đúng tỉ lệ ô ảnh của khung (tính trên mặt nạ rồi quy đổi ra ảnh thật).
    const mh = matte.height;
    const aspectInMatte = (PHOTO_WINDOW_ASPECT * (mw / w)) / (mh / h);
    const r = personCrop(alpha, mw, mh, aspectInMatte);
    const crop = { x: (r.x * w) / mw, y: (r.y * h) / mh, w: (r.w * w) / mw, h: (r.h * h) / mh };

    const out2 = document.createElement('canvas');
    out2.width = Math.max(1, Math.round(crop.w));
    out2.height = Math.max(1, Math.round(crop.h));
    out2.getContext('2d')?.drawImage(canvas, crop.x, crop.y, crop.w, crop.h, 0, 0, out2.width, out2.height);
    return canvasToJpegFile(out2, 'di-anh-phong-xanh.jpg');
}
