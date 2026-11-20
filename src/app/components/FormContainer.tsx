"use client";

import { useEffect, useRef, useState } from 'react';
import { useFieldArray, useForm, type Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import PhotoPicker, { type PhotoValue } from './PhotoPicker';

const MAX_HUONG_LINH = 10;

// Thông tin của 1 hương linh
const huongLinhSchema = yup.object({
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
});

// Validation schema: 1 trai chủ + nhiều hương linh, thời gian ký gửi chọn chung
const schema = yup.object({
    traiChu: yup.string().required('Tên Trai Chủ là bắt buộc'),
    phapDanhTraiChu: yup.string(),
    tuoiTraiChu: yup.string(),
    diaChi: yup.string(),
    huongLinhs: yup.array().of(huongLinhSchema).min(1).max(MAX_HUONG_LINH).required(),
    thoiGianKyGui: yup.string().oneOf(['coThoiHan', 'khongThoiHan']).required('Vui lòng chọn thời gian ký gửi'),
});

type FormData = yup.InferType<typeof schema>;
type HuongLinhData = FormData['huongLinhs'][number];

const emptyHuongLinh: HuongLinhData = {
    huongLinh: '', phapDanhHuongLinh: '', namSinh: '', namMatDuongLich: '', namMatAmLich: '',
    gioMat: '', huongTho: '', noiAnTang: '', tomTatTieuSu: '',
};

type Result = { name: string; framedImage: string | null };

export default function FormContainer() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sendProgress, setSendProgress] = useState<{ current: number; total: number } | null>(null);
    const [results, setResults] = useState<Result[] | null>(null); // có giá trị = đã gửi xong tất cả
    const [sent, setSent] = useState<Record<string, Result>>({}); // hương linh đã gửi thành công (theo id thẻ)
    const [photos, setPhotos] = useState<Record<string, PhotoValue>>({});
    const [triedSubmit, setTriedSubmit] = useState(false);
    const [isTouchDevice, setIsTouchDevice] = useState(false);
    const submitTimeRef = useRef<string | null>(null);

    // Chỉ điện thoại / máy tính bảng mới hiện nút "Chụp ảnh" (máy tính bỏ qua thuộc tính capture).
    useEffect(() => {
        setIsTouchDevice(window.matchMedia('(pointer: coarse)').matches);
    }, []);

    const { register, control, handleSubmit, reset, getValues, formState: { errors } } = useForm<FormData>({
        // yupResolver suy kiểu không khớp với bản yup đang dùng → ép về đúng kiểu form
        resolver: yupResolver(schema) as unknown as Resolver<FormData>,
        defaultValues: {
            huongLinhs: [emptyHuongLinh],
            thoiGianKyGui: 'coThoiHan', // default
        },
    });
    const { fields, append, remove } = useFieldArray({ control, name: 'huongLinhs' });

    const anyPhotoBusy = fields.some((f) => photos[f.id]?.busy);

    const onSubmit = async (data: FormData) => {
        if (anyPhotoBusy) {
            alert('Ảnh đang được xử lý, vui lòng đợi trong giây lát rồi bấm lại');
            return;
        }
        const missing = fields.findIndex((f) => !photos[f.id]?.image);
        if (missing >= 0) {
            alert(`Vui lòng tải lên di ảnh cho Hương Linh thứ ${missing + 1}`);
            return;
        }

        setIsSubmitting(true);
        // Mọi hương linh trong cùng lần đăng ký dùng chung thời gian đăng ký.
        submitTimeRef.current ??= new Date().toLocaleString('vi-VN');
        const done: Record<string, Result> = { ...sent };
        try {
            // Gửi lần lượt từng hương linh (mỗi lần 2 ảnh, không vượt giới hạn 4,5 MB của Vercel).
            for (let i = 0; i < fields.length; i++) {
                const id = fields[i].id;
                if (done[id]) continue; // đã gửi ở lần trước → không gửi trùng
                setSendProgress({ current: i + 1, total: fields.length });

                const hl = data.huongLinhs[i];
                const photo = photos[id];
                const formData = new FormData();
                const fieldsToSend: Record<string, string | undefined> = {
                    traiChu: data.traiChu,
                    phapDanhTraiChu: data.phapDanhTraiChu,
                    tuoiTraiChu: data.tuoiTraiChu,
                    diaChi: data.diaChi,
                    ...hl,
                    thoiGianKyGui: data.thoiGianKyGui,
                    ngayDangKy: submitTimeRef.current,
                };
                Object.entries(fieldsToSend).forEach(([key, value]) => {
                    if (value) formData.append(key, value);
                });
                formData.append('image', photo.image as File); // ảnh dùng để ghép khung
                if (photo.original && photo.original !== photo.image) {
                    formData.append('originalImage', photo.original); // lưu vào cột "Ảnh Gốc"
                }

                const response = await fetch('/api/submit', { method: 'POST', body: formData });
                if (!response.ok) throw new Error(`Gửi hương linh "${hl.huongLinh}" thất bại`);
                const json = await response.json().catch(() => ({}));
                done[id] = { name: hl.huongLinh, framedImage: typeof json.framedImage === 'string' ? json.framedImage : null };
                setSent({ ...done });
            }
            setResults(fields.map((f) => done[f.id]));
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            console.error(error);
            const count = Object.keys(done).length;
            alert(count > 0
                ? `Đã gửi được ${count}/${fields.length} hương linh. Phần còn lại bị lỗi khi gửi — vui lòng bấm "Hoàn tất đăng ký" lần nữa để gửi tiếp (hương linh đã gửi sẽ không bị gửi lại).`
                : 'Đã xảy ra lỗi khi gửi. Vui lòng thử lại!');
        } finally {
            setIsSubmitting(false);
            setSendProgress(null);
        }
    };

    const removeHuongLinh = (index: number) => {
        const id = fields[index].id;
        const name = getValues(`huongLinhs.${index}.huongLinh`);
        if ((name || photos[id]?.image) && !window.confirm(`Xóa Hương Linh thứ ${index + 1}${name ? ` (${name})` : ''} khỏi đơn đăng ký?`)) return;
        remove(index);
        setPhotos((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    };

    // Lưu ảnh thờ: điện thoại mở bảng chia sẻ (có "Lưu ảnh"), máy tính tải file về.
    const saveFramedImage = async (dataUrl: string, name: string) => {
        const blob = await (await fetch(dataUrl)).blob();
        const slug = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
            .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
        const fileName = `anh-tho-${slug || 'huong-linh'}.jpg`;
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        if (isTouchDevice && navigator.canShare?.({ files: [file] })) {
            try {
                await navigator.share({ files: [file], title: 'Ảnh thờ hương linh' });
                return;
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') return; // người dùng tự đóng
            }
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    };

    // Đăng ký lần mới: giữ lại thông tin trai chủ, bắt đầu lại phần hương linh.
    const startNextRegistration = () => {
        const v = getValues();
        reset({
            traiChu: v.traiChu,
            phapDanhTraiChu: v.phapDanhTraiChu,
            tuoiTraiChu: v.tuoiTraiChu,
            diaChi: v.diaChi,
            huongLinhs: [emptyHuongLinh],
            thoiGianKyGui: v.thoiGianKyGui,
        });
        setPhotos({});
        setSent({});
        setResults(null);
        setTriedSubmit(false);
        submitTimeRef.current = null;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (results) {
        return (
            <div className="text-center py-10">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Đăng Ký Thành Công!</h2>
                <p className="text-gray-600 mb-6">
                    Thông tin {results.length > 1 ? `${results.length} Hương Linh` : 'Hương Linh'} đã được tiếp nhận và chuyển đến Thiền Viện Trúc Lâm Chính Pháp.
                </p>

                <div className={`grid gap-8 mb-6 ${results.length > 1 ? 'md:grid-cols-2' : ''}`}>
                    {results.map((r, i) => r.framedImage && (
                        <div key={i}>
                            <img
                                src={r.framedImage}
                                alt={`Ảnh thờ ${r.name}`}
                                className="mx-auto w-full max-w-xs rounded-lg shadow-lg border border-orange-200"
                            />
                            <button
                                type="button"
                                onClick={() => void saveFramedImage(r.framedImage as string, r.name)}
                                className="mt-4 w-full max-w-xs py-3 rounded-xl bg-buddhist-orange text-white font-semibold shadow-sm active:scale-[0.98]"
                            >
                                ⬇️ Lưu ảnh thờ {results.length > 1 ? r.name : 'về máy'}
                            </button>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-gray-500 mb-8 max-w-sm mx-auto">
                    Nếu không lưu được (ví dụ khi mở trong Zalo), hãy nhấn giữ vào ảnh rồi chọn &quot;Lưu ảnh&quot;.
                    Nhà chùa sẽ kiểm tra lại trước khi in ảnh đặt lên bàn thờ.
                </p>

                <button
                    onClick={startNextRegistration}
                    className="px-6 py-3 bg-white border border-buddhist-orange text-buddhist-orange rounded-xl font-semibold hover:bg-orange-50 transition-colors shadow-sm"
                >
                    Đăng ký thêm Hương Linh (giữ thông tin trai chủ)
                </button>
            </div>
        );
    }

    // Common input styling class
    const inputClass = "w-full px-4 py-3 bg-white/50 border border-orange-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-buddhist-orange focus:border-transparent transition-all disabled:bg-gray-100";
    const labelClass = "block text-sm font-semibold text-buddhist-dark/80 mb-2";
    const total = fields.length;

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
                        <input {...register("tuoiTraiChu")} type="number" className={inputClass} placeholder="VD: 45" />
                    </div>
                    <div>
                        <label className={labelClass}>Địa Chỉ</label>
                        <input {...register("diaChi")} className={inputClass} placeholder="Số nhà, Tên đường, Tỉnh/TP" />
                    </div>
                </div>
            </div>

            {/* Section 2: Hương Linh (một hoặc nhiều) */}
            <div className="bg-orange-50/50 p-6 rounded-2xl border border-orange-100/50 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-buddhist-red"></div>
                <h3 className="text-xl font-bold text-buddhist-dark mb-1 border-b border-orange-200 pb-2">2. Thông tin Hương Linh</h3>
                <p className="text-xs text-gray-500 mb-4">Một trai chủ có thể đăng ký nhiều hương linh: bấm &quot;Thêm hương linh&quot; ở cuối mục này.</p>

                <div className="space-y-6">
                    {fields.map((field, index) => {
                        const isSent = !!sent[field.id];
                        const e = errors.huongLinhs?.[index];
                        return (
                            <div key={field.id} className="bg-white/70 border border-orange-200 rounded-2xl p-4 md:p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="font-bold text-buddhist-dark">
                                        Hương Linh {total > 1 ? `thứ ${index + 1}` : ''}
                                        {isSent && <span className="ml-2 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">✓ Đã gửi</span>}
                                    </h4>
                                    {total > 1 && !isSent && (
                                        <button
                                            type="button"
                                            onClick={() => removeHuongLinh(index)}
                                            disabled={isSubmitting}
                                            className="text-sm text-red-600 font-semibold px-3 py-1 rounded-lg hover:bg-red-50"
                                        >
                                            ✕ Xóa
                                        </button>
                                    )}
                                </div>

                                <fieldset disabled={isSent || isSubmitting} className="contents">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                                        <div className="md:col-span-2">
                                            <label className={labelClass}>Tên Hương Linh <span className="text-red-500">*</span></label>
                                            <input {...register(`huongLinhs.${index}.huongLinh`)} className={inputClass} placeholder="Họ và Tên người mất" />
                                            {e?.huongLinh && <p className="text-red-500 text-xs mt-1">{e.huongLinh.message}</p>}
                                        </div>

                                        <div>
                                            <label className={labelClass}>Pháp Danh Hương Linh</label>
                                            <input {...register(`huongLinhs.${index}.phapDanhHuongLinh`)} className={inputClass} />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Hưởng thọ/dương (số tuổi)</label>
                                            <input {...register(`huongLinhs.${index}.huongTho`)} inputMode="numeric" className={inputClass} placeholder="VD: 75" />
                                            <p className="text-gray-500 text-xs mt-1 italic">Không rõ tuổi thì bỏ trống</p>
                                            {e?.huongTho && <p className="text-red-500 text-xs mt-1">{e.huongTho.message}</p>}
                                        </div>

                                        <div>
                                            <label className={labelClass}>Năm Sinh</label>
                                            <input {...register(`huongLinhs.${index}.namSinh`)} inputMode="numeric" className={inputClass} placeholder="VD: 1950" />
                                            <p className="text-gray-500 text-xs mt-1 italic">Không rõ năm sinh thì bỏ trống</p>
                                            {e?.namSinh && <p className="text-red-500 text-xs mt-1">{e.namSinh.message}</p>}
                                        </div>
                                        <div>
                                            <label className={labelClass}>Giờ Mất</label>
                                            <input {...register(`huongLinhs.${index}.gioMat`)} className={inputClass} placeholder="VD: 10:30 sáng" />
                                        </div>

                                        <div>
                                            <label className={labelClass}>Năm Mất Dương Lịch</label>
                                            <input {...register(`huongLinhs.${index}.namMatDuongLich`)} inputMode="numeric" className={inputClass} placeholder="VD: 2025" />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Năm Mất Âm Lịch</label>
                                            <input {...register(`huongLinhs.${index}.namMatAmLich`)} className={inputClass} placeholder="Viết chữ, ví dụ: Ất Tỵ" />
                                            {e?.namMatAmLich && <p className="text-red-500 text-xs mt-1">{e.namMatAmLich.message}</p>}
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className={labelClass}>Nơi An Táng</label>
                                            <input {...register(`huongLinhs.${index}.noiAnTang`)} className={inputClass} placeholder="Nghĩa trang..." />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className={labelClass}>Tóm tắt tiểu sử hương linh</label>
                                            <textarea {...register(`huongLinhs.${index}.tomTatTieuSu`)} className={`${inputClass} min-h-[100px] resize-y`} placeholder="Nhập thông tin tiểu sử của hương linh (như điếu văn)" />
                                        </div>
                                    </div>
                                </fieldset>

                                <div className="md:w-1/2 pt-4 border-t border-orange-200/60">
                                    <PhotoPicker
                                        isTouchDevice={isTouchDevice}
                                        showMissingError={triedSubmit}
                                        disabled={isSent || isSubmitting}
                                        onChange={(value) => setPhotos((prev) => ({ ...prev, [field.id]: value }))}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {total < MAX_HUONG_LINH ? (
                    <button
                        type="button"
                        onClick={() => append(emptyHuongLinh)}
                        disabled={isSubmitting}
                        className="mt-6 w-full py-4 rounded-2xl border-2 border-dashed border-buddhist-orange text-buddhist-orange font-bold bg-white hover:bg-orange-50 active:scale-[0.99] transition"
                    >
                        ➕ Thêm hương linh
                    </button>
                ) : (
                    <p className="mt-6 text-sm text-gray-500 text-center">Mỗi lần đăng ký tối đa {MAX_HUONG_LINH} hương linh.</p>
                )}
            </div>

            {/* Section 3: Thời gian ký gửi (chung cho tất cả hương linh) */}
            <div className="bg-orange-50/50 p-6 rounded-2xl border border-orange-100/50 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-buddhist-orange"></div>
                <h3 className="text-xl font-bold text-buddhist-dark mb-4 border-b border-orange-200 pb-2">3. Thời gian ký gửi</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-5 rounded-xl border border-orange-200">
                        <label className={labelClass}>
                            Thời gian ký gửi {total > 1 ? '(áp dụng cho tất cả hương linh)' : ''} <span className="text-red-500">*</span>
                        </label>
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
                    <div>
                        <label className={labelClass}>Ngày đăng ký</label>
                        <div className="px-4 py-3 bg-gray-50 text-gray-600 rounded-xl border border-gray-200 text-sm font-medium">
                            Ghi tự động theo thời điểm bạn bấm gửi
                        </div>
                    </div>
                </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6">
                <button
                    onClick={() => {
                        setTriedSubmit(true);
                        void handleSubmit(onSubmit)();
                    }}
                    type="button"
                    disabled={isSubmitting || anyPhotoBusy}
                    className={`w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg transition-all duration-300 relative overflow-hidden group
            ${isSubmitting ? 'bg-orange-400 cursor-not-allowed' : 'bg-gradient-to-r from-buddhist-orange to-buddhist-red hover:shadow-orange-500/30 hover:-translate-y-1'}`}
                >
                    {isSubmitting ? (
                        <span className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {sendProgress && sendProgress.total > 1
                                ? `ĐANG GỬI ${sendProgress.current}/${sendProgress.total}...`
                                : 'ĐANG GỬI, VUI LÒNG CHỜ...'}
                        </span>
                    ) : (
                        <>
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                HOÀN TẤT ĐĂNG KÝ{total > 1 ? ` (${total} HƯƠNG LINH)` : ''}
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
