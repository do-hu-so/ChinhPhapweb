"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { prepareImage } from '../lib/prepareImage';
import { preloadBackgroundRemover, replaceBackgroundWithBlue, type BgProgress } from '../lib/removeBackground';

// Validation schema
const schema = yup.object().shape({
    traiChu: yup.string().required('Tên Trai Chủ là bắt buộc'),
    phapDanhTraiChu: yup.string(),
    tuoiTraiChu: yup.string(),
    diaChi: yup.string(),

    huongLinh: yup.string().required('Tên Hương Linh là bắt buộc'),
    phapDanhHuongLinh: yup.string(),
    namSinh: yup.string()
        .test(
            'year',
            'Nhập năm sinh 4 chữ số (VD: 1950). Không rõ năm sinh thì bỏ trống',
            value => !value || /(1[89]\d{2}|20\d{2})/.test(value)
        ),
    namMatDuongLich: yup.string(),
    namMatAmLich: yup.string()
        .test(
            'no-numbers',
            'Vui lòng chỉ nhập chữ, không nhập số (VD: Ất Tỵ)',
            value => !value || !/\d/.test(value)
        ),
    gioMat: yup.string(),
    huongTho: yup.string()
        .test(
            'age-number',
            'Chỉ nhập số tuổi (VD: 75). Không rõ tuổi thì bỏ trống',
            value => !value || /\d/.test(value)
        ),
    noiAnTang: yup.string(),
    tomTatTieuSu: yup.string(),

    thoiGianKyGui: yup.string().oneOf(['coThoiHan', 'khongThoiHan']).required('Vui lòng chọn thời gian ký gửi'),
});

type FormData = yup.InferType<typeof schema>;

export default function FormContainer() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [isPreparingImage, setIsPreparingImage] = useState(false);
    const [originalFile, setOriginalFile] = useState<File | null>(null); // ảnh gốc đã xoay + nén
    const [blueFile, setBlueFile] = useState<File | null>(null); // ảnh đã xoá nền, thay phông xanh
    const [useBlueBg, setUseBlueBg] = useState(true);
    const [bgStatus, setBgStatus] = useState<'idle' | 'loading' | 'processing' | 'failed'>('idle');
    const [bgPercent, setBgPercent] = useState<number | null>(null);
    const bgJobRef = useRef(0);
    const [imageError, setImageError] = useState<string | null>(null);
    const [triedSubmit, setTriedSubmit] = useState(false);
    const [isTouchDevice, setIsTouchDevice] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    // Chỉ điện thoại / máy tính bảng mới hiện nút "Chụp ảnh" (máy tính bỏ qua thuộc tính capture).
    useEffect(() => {
        setIsTouchDevice(window.matchMedia('(pointer: coarse)').matches);
    }, []);

    // Ảnh sẽ gửi đi và hiện xem trước: ảnh phông xanh nếu đã có và đang bật, ngược lại là ảnh gốc.
    const selectedFile = useBlueBg && blueFile ? blueFile : originalFile;
    const previewImage = useMemo(() => (selectedFile ? URL.createObjectURL(selectedFile) : null), [selectedFile]);
    useEffect(() => () => { if (previewImage) URL.revokeObjectURL(previewImage); }, [previewImage]);
    const isBgBusy = bgStatus === 'loading' || bgStatus === 'processing';
    const isImageBusy = isPreparingImage || isBgBusy;

    const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
        // @ts-expect-error - yupResolver types mismatch with this specific yup version
        resolver: yupResolver(schema),
        defaultValues: {
            thoiGianKyGui: 'coThoiHan' // default
        }
    });

    const onSubmit = async (data: FormData) => {
        if (isImageBusy) {
            alert("Ảnh đang được xử lý, vui lòng đợi trong giây lát rồi bấm lại");
            return;
        }
        if (!selectedFile) {
            alert("Vui lòng tải lên 1 tấm Di Ảnh của vị Hương Linh");
            return;
        }

        setIsSubmitting(true);
        try {
            // Create FormData to send both text and file
            const formData = new FormData();
            Object.entries(data).forEach(([key, value]) => {
                if (value) formData.append(key, value as string);
            });
            formData.append('image', selectedFile); // ảnh dùng để ghép khung
            if (originalFile && selectedFile !== originalFile) {
                formData.append('originalImage', originalFile); // lưu vào cột "Ảnh Gốc"
            }
            // Append real-time registration date
            formData.append('ngayDangKy', new Date().toLocaleString('vi-VN'));

            // In real APP: send to /api/process
            console.log('Form data to submit', Object.fromEntries(formData.entries()));

            const response = await fetch('/api/submit', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('API submission failed');
            }

            setSubmitSuccess(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            console.error(error);
            alert('Đã xảy ra lỗi khi gửi. Vui lòng thử lại!');
        } finally {
            setIsSubmitting(false);
        }
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

    const toggleBlueBg = (checked: boolean) => {
        setUseBlueBg(checked);
        if (checked && originalFile && !blueFile && !isBgBusy) void runBlueBackground(originalFile);
    };

    const openPicker = (input: HTMLInputElement | null) => {
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
        void handleFile(e.dataTransfer.files?.[0]);
    };

    if (submitSuccess) {
        return (
            <div className="text-center py-10">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Đăng Ký Thành Công!</h2>
                <p className="text-gray-600 mb-8">
                    Thông tin Hương Linh đã được tiếp nhận và chuyển đến Thiền Viện Trúc Lâm Chính Pháp.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-2 bg-buddhist-orange text-white rounded-lg font-medium hover:bg-orange-600 transition-colors shadow-sm"
                >
                    Đăng ký Hương Linh khác
                </button>
            </div>
        );
    }

    // Common input styling class
    const inputClass = "w-full px-4 py-3 bg-white/50 border border-orange-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-buddhist-orange focus:border-transparent transition-all";
    const labelClass = "block text-sm font-semibold text-buddhist-dark/80 mb-2";

    return (
        <form className="space-y-8">

            {/* Section 1: Trai Chủ */}
            <div className="bg-orange-50/50 p-6 rounded-2xl border border-orange-100/50 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-buddhist-orange"></div>
                <h3 className="text-xl font-bold text-buddhist-dark mb-4 border-b border-orange-200 pb-2">1. Thông tin Trai Chủ</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className={labelClass}>Tên Trai Chủ <span className="text-red-500">*</span></label>
                        <input {...register("traiChu")} className={inputClass} placeholder="Nguyễn Văn A" />
                        {errors.traiChu && <p className="text-red-500 text-xs mt-1">{errors.traiChu.message}</p>}
                    </div>
                    <div>
                        <label className={labelClass}>Pháp Danh</label>
                        <input {...register("phapDanhTraiChu")} className={inputClass} placeholder="Thích Tâm Hướng" />
                    </div>
                    <div>
                        <label className={labelClass}>Tuổi</label>
                        <input {...register("tuoiTraiChu")} type="number" className={inputClass} placeholder="e.g. 45" />
                    </div>
                    <div>
                        <label className={labelClass}>Địa Chỉ</label>
                        <input {...register("diaChi")} className={inputClass} placeholder="Số nhà, Tên đường, Tỉnh/TP" />
                    </div>
                </div>
            </div>

            {/* Section 2: Hương Linh */}
            <div className="bg-orange-50/50 p-6 rounded-2xl border border-orange-100/50 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-buddhist-red"></div>
                <h3 className="text-xl font-bold text-buddhist-dark mb-4 border-b border-orange-200 pb-2">2. Thông tin Hương Linh</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                    <div className="md:col-span-2">
                        <label className={labelClass}>Tên Hương Linh <span className="text-red-500">*</span></label>
                        <input {...register("huongLinh")} className={inputClass} placeholder="Họ và Tên người mất" />
                        {errors.huongLinh && <p className="text-red-500 text-xs mt-1">{errors.huongLinh.message}</p>}
                    </div>

                    <div>
                        <label className={labelClass}>Pháp Danh Hương Linh</label>
                        <input {...register("phapDanhHuongLinh")} className={inputClass} />
                    </div>
                    <div>
                        <label className={labelClass}>Hưởng thọ/dương (số tuổi)</label>
                        <input {...register("huongTho")} inputMode="numeric" className={inputClass} placeholder="VD: 75" />
                        <p className="text-gray-500 text-xs mt-1 italic">Không rõ tuổi thì bỏ trống</p>
                        {errors.huongTho && <p className="text-red-500 text-xs mt-1">{errors.huongTho.message}</p>}
                    </div>

                    <div>
                        <label className={labelClass}>Năm Sinh</label>
                        <input {...register("namSinh")} inputMode="numeric" className={inputClass} placeholder="VD: 1950" />
                        <p className="text-gray-500 text-xs mt-1 italic">Không rõ năm sinh thì bỏ trống</p>
                        {errors.namSinh && <p className="text-red-500 text-xs mt-1">{errors.namSinh.message}</p>}
                    </div>
                    <div>
                        <label className={labelClass}>Giờ Mất</label>
                        <input {...register("gioMat")} className={inputClass} placeholder="e.g. 10:30 Sáng" />
                    </div>

                    <div>
                        <label className={labelClass}>Năm Mất Dương Lịch</label>
                        <input {...register("namMatDuongLich")} className={inputClass} placeholder="e.g. 2025" />
                    </div>
                    <div>
                        <label className={labelClass}>Năm Mất Âm Lịch</label>
                        <input {...register("namMatAmLich")} className={inputClass} placeholder="Viết chữ, ví dụ: Ất Tỵ" />
                        {errors.namMatAmLich && <p className="text-red-500 text-xs mt-1">{errors.namMatAmLich.message}</p>}
                    </div>

                    <div className="md:col-span-2">
                        <label className={labelClass}>Nơi An Táng</label>
                        <input {...register("noiAnTang")} className={inputClass} placeholder="Nghĩa trang..." />
                    </div>

                    <div className="md:col-span-2">
                        <label className={labelClass}>Tóm tắt tiểu sử hương linh</label>
                        <textarea {...register("tomTatTieuSu")} className={`${inputClass} min-h-[100px] resize-y`} placeholder="nhập thông tin tiểu sử của hương linh (như điếu văn)" />
                    </div>
                </div>

                {/* Section: Upload Photos & Realtime info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start mt-8 pt-6 border-t border-orange-200/60">

                    {/* Photo Upload Box */}
                    <div>
                        <label className={labelClass}>Di Ảnh (4x6) <span className="text-red-500">*</span></label>
                        <p className="text-xs text-buddhist-frame mb-3">
                            Chọn ảnh rõ mặt, chụp thẳng. Ảnh sẽ tự xoay đúng chiều, xóa nền và thay phông xanh để làm ảnh thờ.
                        </p>

                        {/* Ô chọn ảnh ẩn: thư viện ảnh / tệp trên máy */}
                        <input
                            ref={galleryInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                        />
                        {/* Ô chọn ảnh ẩn: mở thẳng camera sau của điện thoại */}
                        <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleImageChange}
                            className="hidden"
                        />

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
                                <div className="relative w-40 h-52 rounded-lg overflow-hidden border border-orange-200 shadow-sm">
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
                                    disabled={isImageBusy}
                                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-buddhist-orange text-white font-semibold shadow-sm active:scale-[0.98] disabled:opacity-60"
                                >
                                    📷 Chụp ảnh
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => openPicker(galleryInputRef.current)}
                                disabled={isImageBusy}
                                className="flex items-center justify-center gap-2 py-3 rounded-xl border border-buddhist-orange text-buddhist-orange bg-white font-semibold shadow-sm active:scale-[0.98] disabled:opacity-60"
                            >
                                🖼️ {selectedFile ? 'Đổi ảnh' : isTouchDevice ? 'Chọn ảnh' : 'Chọn ảnh từ máy'}
                            </button>
                        </div>

                        <label className="flex items-start gap-2 mt-3 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={useBlueBg}
                                onChange={(e) => toggleBlueBg(e.target.checked)}
                                className="mt-0.5 w-5 h-5 accent-buddhist-orange"
                            />
                            <span className="text-sm text-gray-700">Xóa nền, thay phông xanh cho ảnh thờ <span className="text-gray-400">(nên dùng)</span></span>
                        </label>
                        {useBlueBg && bgStatus === 'failed' && (
                            <p className="text-amber-600 text-xs mt-2">
                                Không tách được nền tự động cho ảnh này, đang dùng ảnh gốc. Kiểm tra mạng rồi{' '}
                                <button
                                    type="button"
                                    onClick={() => originalFile && void runBlueBackground(originalFile)}
                                    className="underline font-semibold"
                                >
                                    thử lại
                                </button>
                                , hoặc chọn ảnh khác rõ mặt hơn.
                            </p>
                        )}

                        {imageError && <p className="text-red-500 text-xs mt-2">{imageError}</p>}
                        {!imageError && triedSubmit && !selectedFile && <p className="text-red-500 text-xs mt-2">Vui lòng tải lên di ảnh</p>}
                    </div>

                    {/* Registration Info */}
                    <div className="space-y-6">
                        <div>
                            <label className={labelClass}>Ngày đăng ký</label>
                            <div className="px-4 py-3 bg-gray-50 text-gray-600 rounded-xl border border-gray-200 text-sm font-medium">
                                Ghi tự động theo thời điểm bạn bấm gửi
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-xl border border-orange-200">
                            <label className={labelClass}>Thời gian ký gửi <span className="text-red-500">*</span></label>
                            <div className="space-y-3 mt-3">
                                <label className="flex items-center space-x-3 cursor-pointer group">
                                    <input
                                        type="radio"
                                        value="coThoiHan"
                                        {...register("thoiGianKyGui")}
                                        className="w-5 h-5 text-buddhist-orange focus:ring-buddhist-orange border-gray-300 pointer-events-none"
                                    />
                                    <span className="text-gray-700 font-medium group-hover:text-black transition-colors">Ký gửi có thời hạn</span>
                                </label>

                                <label className="flex items-center space-x-3 cursor-pointer group">
                                    <input
                                        type="radio"
                                        value="khongThoiHan"
                                        {...register("thoiGianKyGui")}
                                        className="w-5 h-5 text-buddhist-orange focus:ring-buddhist-orange border-gray-300 pointer-events-none"
                                    />
                                    <span className="text-gray-700 font-medium group-hover:text-black transition-colors">Ký gửi KHÔNG thời hạn</span>
                                </label>
                            </div>
                            {errors.thoiGianKyGui && <p className="text-red-500 text-xs mt-1">{errors.thoiGianKyGui.message}</p>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6">
                <button
                    onClick={() => {
                        setTriedSubmit(true);
                        void handleSubmit(onSubmit as any)();
                    }}
                    type="button"
                    disabled={isSubmitting || isImageBusy}
                    className={`w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg transition-all duration-300 relative overflow-hidden group
            ${isSubmitting ? 'bg-orange-400 cursor-not-allowed' : 'bg-gradient-to-r from-buddhist-orange to-buddhist-red hover:shadow-orange-500/30 hover:-translate-y-1'}`}
                >
                    {isSubmitting ? (
                        <span className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            ĐANG GỬI, VUI LÒNG CHỜ...
                        </span>
                    ) : (
                        <>
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                HOÀN TẤT ĐĂNG KÝ
                                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </span>
                            <div className="absolute inset-0 h-full w-full bg-white/20 scale-x-0 origin-left group-hover:scale-x-100 transition-transform duration-500 ease-out"></div>
                        </>
                    )}
                </button>
            </div>

        </form>
    );
}
