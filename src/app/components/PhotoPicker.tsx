"use client";

// Khung chọn di ảnh cho 1 hương linh: chụp / chọn ảnh, tự xoay + nén, xoá nền thay phông xanh, xem trước.

import { useEffect, useMemo, useRef, useState } from 'react';
import { prepareImage } from '../lib/prepareImage';
import { preloadBackgroundRemover, replaceBackgroundWithBlue, type BgProgress } from '../lib/removeBackground';

export type PhotoValue = {
    image: File | null; // ảnh dùng để ghép khung (phông xanh nếu có)
    original: File | null; // ảnh gốc đã xoay + nén (lưu cột "Ảnh Gốc")
    busy: boolean; // đang xử lý ảnh
};

type Props = {
    isTouchDevice: boolean;
    showMissingError: boolean;
    disabled?: boolean;
    onChange: (value: PhotoValue) => void;
};

export default function PhotoPicker({ isTouchDevice, showMissingError, disabled = false, onChange }: Props) {
    const [isPreparingImage, setIsPreparingImage] = useState(false);
    const [originalFile, setOriginalFile] = useState<File | null>(null);
    const [blueFile, setBlueFile] = useState<File | null>(null);
    const [useBlueBg, setUseBlueBg] = useState(true);
    const [bgStatus, setBgStatus] = useState<'idle' | 'loading' | 'processing' | 'failed'>('idle');
    const [bgPercent, setBgPercent] = useState<number | null>(null);
    const [imageError, setImageError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const bgJobRef = useRef(0);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const selectedFile = useBlueBg && blueFile ? blueFile : originalFile;
    const previewImage = useMemo(() => (selectedFile ? URL.createObjectURL(selectedFile) : null), [selectedFile]);
    useEffect(() => () => { if (previewImage) URL.revokeObjectURL(previewImage); }, [previewImage]);
    const isBgBusy = bgStatus === 'loading' || bgStatus === 'processing';
    const isImageBusy = isPreparingImage || isBgBusy;

    // Báo cho form cha mỗi khi ảnh hoặc trạng thái xử lý thay đổi.
    const onChangeRef = useRef(onChange);
    useEffect(() => { onChangeRef.current = onChange; });
    useEffect(() => {
        onChangeRef.current({ image: selectedFile, original: originalFile, busy: isImageBusy });
    }, [selectedFile, originalFile, isImageBusy]);

    // Xoá nền + thay phông xanh (chạy trong trình duyệt). Lỗi thì giữ ảnh gốc.
    const runBlueBackground = async (photo: File) => {
        const job = ++bgJobRef.current;
        setBgStatus('loading');
        setBgPercent(null);
        const onProgress = (p: BgProgress) => {
            if (job !== bgJobRef.current) return;
            setBgStatus(p.stage);
            if (p.percent !== undefined) setBgPercent(p.percent);
        };
        for (let attempt = 1; attempt <= 2; attempt++) { // mạng chập chờn: tự thử lại 1 lần
            try {
                const result = await replaceBackgroundWithBlue(photo, onProgress);
                if (job !== bgJobRef.current) return; // đã chọn ảnh khác trong lúc chờ
                setBlueFile(result);
                setBgStatus('idle');
                return;
            } catch (err) {
                console.error(`Tách nền thất bại (lần ${attempt}):`, err);
                if (job !== bgJobRef.current) return;
            }
        }
        setBgStatus('failed');
    };

    // Xoay đúng chiều + thu nhỏ + nén ảnh ngay trên máy rồi mới dùng làm di ảnh.
    const handleFile = async (file?: File | null) => {
        if (!file) return;
        if (file.type && !file.type.startsWith('image/')) {
            setImageError('Vui lòng chọn tệp ảnh (JPG, PNG).');
            return;
        }
        setImageError(null);
        setIsPreparingImage(true);
        preloadBackgroundRemover();
        try {
            const prepared = await prepareImage(file);
            bgJobRef.current++; // huỷ lượt tách nền của ảnh cũ (nếu còn chạy)
            setOriginalFile(prepared);
            setBlueFile(null);
            setBgStatus('idle');
            if (useBlueBg) void runBlueBackground(prepared);
        } catch (err) {
            setImageError(err instanceof Error ? err.message : 'Không đọc được ảnh, vui lòng chọn ảnh khác.');
        } finally {
            setIsPreparingImage(false);
        }
    };

    const toggleBlueBg = (checked: boolean) => {
        setUseBlueBg(checked);
        if (checked && originalFile && !blueFile && !isBgBusy) void runBlueBackground(originalFile);
    };

    const openPicker = (input: HTMLInputElement | null) => {
        if (disabled) return;
        preloadBackgroundRemover(); // tải sẵn bộ tách nền trong lúc người dùng chọn ảnh
        input?.click();
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // cho phép chọn lại cùng một ảnh
        void handleFile(file);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        if (!disabled) void handleFile(e.dataTransfer.files?.[0]);
    };

    return (
        <div>
            <label className="block text-sm font-semibold text-buddhist-dark/80 mb-2">Di Ảnh (4x6) <span className="text-red-500">*</span></label>
            <p className="text-xs text-buddhist-frame mb-3">
                Chọn ảnh rõ mặt, chụp thẳng. Ảnh sẽ tự xoay đúng chiều, xóa nền và thay phông xanh để làm ảnh thờ.
            </p>

            {/* Ô chọn ảnh ẩn: thư viện ảnh / tệp trên máy */}
            <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            {/* Ô chọn ảnh ẩn: mở thẳng camera sau của điện thoại */}
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageChange} className="hidden" />

            <div
                role="button"
                tabIndex={0}
                onClick={() => openPicker(galleryInputRef.current)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openPicker(galleryInputRef.current); }}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors cursor-pointer
               ${isDragging ? 'border-buddhist-orange bg-orange-100' : previewImage ? 'border-buddhist-orange bg-orange-50' : 'border-gray-300 hover:bg-gray-50 bg-white'}`}>

                {previewImage ? (
                    <div className="relative w-40 aspect-[31/50] rounded-lg overflow-hidden border border-orange-200 shadow-sm">
                        <img src={previewImage} alt="Di ảnh đã chọn" className="w-full h-full object-cover" />
                    </div>
                ) : (
                    <div className="py-6">
                        <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <p className="text-sm font-medium text-gray-600">
                            {isTouchDevice ? 'Chạm để chọn ảnh' : 'Nhấn để chọn ảnh hoặc kéo thả ảnh vào đây'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Hỗ trợ ảnh JPG, PNG</p>
                    </div>
                )}

                {isImageBusy && (
                    <div className="absolute inset-0 bg-white/85 rounded-xl flex flex-col items-center justify-center px-4 gap-1">
                        <span className="text-sm font-semibold text-buddhist-orange">
                            {isPreparingImage
                                ? 'Đang xử lý ảnh...'
                                : bgStatus === 'loading'
                                    ? `Đang tải bộ tách nền${bgPercent !== null ? ` ${bgPercent}%` : ''}...`
                                    : 'Đang xóa nền, thay phông xanh...'}
                        </span>
                        {bgStatus === 'loading' && !isPreparingImage && (
                            <span className="text-xs text-gray-500">Chỉ lần đầu mới phải tải, vui lòng chờ</span>
                        )}
                    </div>
                )}
            </div>

            <div className={`grid gap-3 mt-3 ${isTouchDevice ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {isTouchDevice && (
                    <button
                        type="button"
                        onClick={() => openPicker(cameraInputRef.current)}
                        disabled={isImageBusy || disabled}
                        className="flex items-center justify-center gap-2 py-3 rounded-xl bg-buddhist-orange text-white font-semibold shadow-sm active:scale-[0.98] disabled:opacity-60"
                    >
                        📷 Chụp ảnh
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => openPicker(galleryInputRef.current)}
                    disabled={isImageBusy || disabled}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl border border-buddhist-orange text-buddhist-orange bg-white font-semibold shadow-sm active:scale-[0.98] disabled:opacity-60"
                >
                    🖼️ {selectedFile ? 'Đổi ảnh' : isTouchDevice ? 'Chọn ảnh' : 'Chọn ảnh từ máy'}
                </button>
            </div>

            <label className="flex items-start gap-2 mt-3 cursor-pointer select-none">
                <input
                    type="checkbox"
                    checked={useBlueBg}
                    disabled={disabled}
                    onChange={(e) => toggleBlueBg(e.target.checked)}
                    className="mt-0.5 w-5 h-5 accent-buddhist-orange"
                />
                <span className="text-sm text-gray-700">Xóa nền, thay phông xanh cho ảnh thờ <span className="text-gray-400">(nên dùng)</span></span>
            </label>
            {useBlueBg && bgStatus === 'failed' && (
                <p className="text-amber-600 text-xs mt-2">
                    Không tách được nền tự động cho ảnh này, đang dùng ảnh gốc. Kiểm tra mạng rồi{' '}
                    <button type="button" onClick={() => originalFile && void runBlueBackground(originalFile)} className="underline font-semibold">
                        thử lại
                    </button>
                    , hoặc chọn ảnh khác rõ mặt hơn.
                </p>
            )}

            {imageError && <p className="text-red-500 text-xs mt-2">{imageError}</p>}
            {!imageError && showMissingError && !selectedFile && <p className="text-red-500 text-xs mt-2">Vui lòng tải lên di ảnh</p>}
        </div>
    );
}
