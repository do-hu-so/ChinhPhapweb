// Tự cắt ảnh quanh người (dựa vào mặt nạ tách nền) theo đúng tỉ lệ ô ảnh của khung thờ,
// để người đứng lệch hay ảnh chụp ngang không bị cắt mất khi ghép khung.

export type Rect = { x: number; y: number; w: number; h: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/** Khung cắt lớn nhất đúng tỉ lệ, đặt giữa ảnh (dùng khi không tìm thấy người). */
export function centerCrop(w: number, h: number, aspect: number): Rect {
    let cw = w;
    let ch = cw / aspect;
    if (ch > h) {
        ch = h;
        cw = ch * aspect;
    }
    return { x: Math.round((w - cw) / 2), y: Math.round((h - ch) / 2), w: Math.round(cw), h: Math.round(ch) };
}

/**
 * Khung cắt tỉ lệ `aspect` (rộng/cao) bao người trong mặt nạ `alpha` (w x h, 0–255):
 * căn giữa theo người, chừa khoảng trống trên đầu; ảnh toàn thân thì lấy nửa trên cho mặt đủ lớn.
 */
export function personCrop(alpha: ArrayLike<number>, w: number, h: number, aspect: number, threshold = 128): Rect {
    let minX = w, maxX = -1, minY = h, maxY = -1;
    const step = Math.max(1, Math.floor(Math.min(w, h) / 600));
    for (let y = 0; y < h; y += step) {
        const row = y * w;
        for (let x = 0; x < w; x += step) {
            if (alpha[row + x] >= threshold) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    if (maxX < 0) return centerCrop(w, h, aspect);

    const personW = maxX - minX + 1;
    const personH = maxY - minY + 1;
    // Đủ rộng cho vai, đủ cao cho người + khoảng trống trên đầu, nhưng không quá cao (ảnh toàn thân).
    let cropH = Math.max((personW * 1.08) / aspect, Math.min(personH * 1.12, (personW * 1.5) / aspect));
    cropH = Math.min(cropH, h);
    let cropW = cropH * aspect;
    if (cropW > w) {
        cropW = w;
        cropH = cropW / aspect;
    }

    const x = clamp((minX + maxX) / 2 - cropW / 2, 0, w - cropW);
    const y = clamp(minY - cropH * 0.06, 0, h - cropH);
    return { x: Math.round(x), y: Math.round(y), w: Math.round(cropW), h: Math.round(cropH) };
}
