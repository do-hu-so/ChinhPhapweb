// Chuẩn bị di ảnh ngay trên máy người dùng trước khi gửi lên server:
//  - Vercel chỉ nhận tối đa 4,5 MB mỗi lần gửi, trong khi ảnh chụp điện thoại thường 3–12 MB.
//  - Vẽ lại ảnh qua canvas: trình duyệt tự xoay đúng chiều theo EXIF, đồng thời xoá EXIF (kể cả toạ độ GPS).

const MAX_SIDE = 2400; // dư cho ô ảnh của khung in (~1100x1780 px)
const MAX_BYTES = 3.5 * 1024 * 1024;
const QUALITIES = [0.9, 0.8, 0.7];

function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Không đọc được ảnh này. Vui lòng chọn ảnh JPG/PNG khác hoặc chụp lại.'));
        };
        img.src = url;
    });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('Không xử lý được ảnh, vui lòng thử lại.'))),
            'image/jpeg',
            quality,
        );
    });
}

export async function prepareImage(file: File): Promise<File> {
    const img = await loadImage(file);
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height) throw new Error('Ảnh không hợp lệ, vui lòng chọn ảnh khác.');

    let scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    for (let attempt = 0; attempt < 4; attempt++) {
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh, vui lòng dùng trình duyệt khác.');

        ctx.fillStyle = '#FFFFFF'; // nền trắng cho ảnh PNG trong suốt
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        for (const quality of QUALITIES) {
            const blob = await canvasToJpeg(canvas, quality);
            if (blob.size <= MAX_BYTES) {
                return new File([blob], 'di-anh.jpg', { type: 'image/jpeg', lastModified: Date.now() });
            }
        }
        scale *= 0.75;
    }
    throw new Error('Ảnh quá lớn, vui lòng chọn ảnh khác.');
}
