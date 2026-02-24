"use client";

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';

// Validation schema
const schema = yup.object().shape({
    traiChu: yup.string().required('Tên Trai Chủ là bắt buộc'),
    phapDanhTraiChu: yup.string(),
    tuoiTraiChu: yup.string(),
    diaChi: yup.string(),

    huongLinh: yup.string().required('Tên Hương Linh là bắt buộc'),
    phapDanhHuongLinh: yup.string(),
    namSinh: yup.string(),
    namMatDuongLich: yup.string(),
    namMatAmLich: yup.string(),
    gioMat: yup.string(),
    huongTho: yup.string().required('Hưởng thọ/Hưởng dương là bắt buộc'),
    noiAnTang: yup.string(),

    thoiGianKyGui: yup.string().oneOf(['coThoiHan', 'khongThoiHan']).required('Vui lòng chọn thời gian ký gửi'),
});

type FormData = yup.InferType<typeof schema>;

export default function FormContainer() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [submitSuccess, setSubmitSuccess] = useState(false);

    const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
        // @ts-expect-error - yupResolver types mismatch with this specific yup version
        resolver: yupResolver(schema),
        defaultValues: {
            thoiGianKyGui: 'coThoiHan' // default
        }
    });

    const onSubmit = async (data: FormData) => {
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
            formData.append('image', selectedFile);
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

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
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
                    Thông tin Hương Linh đã được tiếp nhận. Đang xử lý Di Ảnh và chuyển đến Chùa chuẩn bị Lễ Cúng.
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
                        <label className={labelClass}>Hưởng thọ/dương <span className="text-red-500">*</span></label>
                        <input {...register("huongTho")} className={inputClass} placeholder="e.g. Hưởng thọ 75 tuổi" />
                        {errors.huongTho && <p className="text-red-500 text-xs mt-1">{errors.huongTho.message}</p>}
                    </div>

                    <div>
                        <label className={labelClass}>Năm Sinh</label>
                        <input {...register("namSinh")} className={inputClass} placeholder="e.g. 1950" />
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
                    </div>

                    <div className="md:col-span-2">
                        <label className={labelClass}>Nơi An Táng</label>
                        <input {...register("noiAnTang")} className={inputClass} placeholder="Nghĩa trang..." />
                    </div>
                </div>

                {/* Section: Upload Photos & Realtime info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start mt-8 pt-6 border-t border-orange-200/60">

                    {/* Photo Upload Box */}
                    <div>
                        <label className={labelClass}>Di Ảnh (4x6) <span className="text-red-500">*</span></label>
                        <p className="text-xs text-buddhist-frame mb-3">AI sẽ tự động tách nền và loại bỏ chữ trên ảnh để tạo khung 20x30 chuyên nghiệp.</p>

                        <div className={`relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-colors
                           ${previewImage ? 'border-buddhist-orange bg-orange-50' : 'border-gray-300 hover:bg-gray-50 bg-white'}`}>

                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />

                            {previewImage ? (
                                <div className="relative w-32 h-40 rounded-lg overflow-hidden border border-orange-200 shadow-sm z-0">
                                    <img src={previewImage} alt="Preview" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                        <span className="text-white text-xs font-semibold">Thay đổi (Chạm lại)</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-8 z-0">
                                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                    </svg>
                                    <p className="text-sm font-medium text-gray-600">Nhấn hoặc kéo thả ảnh vào đây</p>
                                    <p className="text-xs text-gray-400 mt-1">Hỗ trợ .jpg, .png</p>
                                </div>
                            )}
                        </div>
                        {!selectedFile && <p className="text-red-500 text-xs mt-2">Vui lòng tải lên di ảnh</p>}
                    </div>

                    {/* Registration Info */}
                    <div className="space-y-6">
                        <div>
                            <label className={labelClass}>Ngày đăng ký</label>
                            <div className="px-4 py-3 bg-gray-50 text-gray-600 rounded-xl border border-gray-200 text-sm font-medium">
                                Sẽ tự động cập nhật thời gian gửi là: {new Date().toLocaleString('vi-VN')}
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
                    onClick={handleSubmit(onSubmit as any)}
                    type="button"
                    disabled={isSubmitting}
                    className={`w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg transition-all duration-300 relative overflow-hidden group
            ${isSubmitting ? 'bg-orange-400 cursor-not-allowed' : 'bg-gradient-to-r from-buddhist-orange to-buddhist-red hover:shadow-orange-500/30 hover:-translate-y-1'}`}
                >
                    {isSubmitting ? (
                        <span className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            ĐANG XỬ LÝ ẢNH AI...
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
