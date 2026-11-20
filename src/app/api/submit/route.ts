import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
// import { google } from 'googleapis'; // Removed, now using Apps Script
import sharp from 'sharp';
import { createCanvas, loadImage, registerFont } from 'canvas';
import { buildAgeLine, buildNameLine, buildYearsLine } from '../../lib/portraitText';
import { NAMEPLATE_HEIGHT, PHOTO_WINDOW } from '../../lib/frameLayout';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        // image: ảnh dùng để ghép khung (đã xoá nền, thay phông xanh nếu gia đình chọn)
        // originalImage: ảnh gốc gia đình tải lên (không bắt buộc) — lưu vào cột "Ảnh Gốc"
        const imageFile = formData.get('image');
        const originalEntry = formData.get('originalImage');

        if (!(imageFile instanceof File)) {
            return NextResponse.json({ error: 'No image provided' }, { status: 400 });
        }

        // Extract all text fields
        const data: Record<string, string> = {};
        formData.forEach((value, key) => {
            if (typeof value === 'string') {
                data[key] = value;
            }
        });

        console.log('Received submission for:', data.huongLinh);

        // 1. Image Compositing with Sharp and Canvas
        const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
        const originalBuffer = originalEntry instanceof File ? Buffer.from(await originalEntry.arrayBuffer()) : imageBuffer;

        // Load the template frame
        const framePath = path.join(process.cwd(), 'image', 'khung_tho_2.png');
        const frameImg = await loadImage(framePath);

        // Calculate proportions (Scale 2x for high quality output)
        const canvasW = frameImg.width * 2; // e.g. 840 * 2 = 1680
        const canvasH = frameImg.height * 2; // e.g. 1248 * 2 = 2496

        // Ensure fonts are registered before creating canvas
        try {
            const boldFontPath = path.join(process.cwd(), 'public', 'fonts', 'Roboto-Bold.ttf');
            const regularFontPath = path.join(process.cwd(), 'public', 'fonts', 'Roboto-Regular.ttf');
            registerFont(boldFontPath, { family: 'Roboto', weight: 'bold' });
            registerFont(regularFontPath, { family: 'Roboto', weight: 'normal' });
        } catch (fontErr) {
            console.error('Warning: Could not register fonts. Falling back to default.', fontErr);
        }

        const canvas = createCanvas(canvasW, canvasH);
        const ctx = canvas.getContext('2d');

        // Draw Background (White to avoid transparency issues in JPG)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvasW, canvasH);

        // Determine safe inner area for the portrait (~21% X, 14% Y from analysis)
        // Adjusting slightly to cover the left white border based on user feedback
        const safeX = canvasW * PHOTO_WINDOW.x;
        const safeY = canvasH * PHOTO_WINDOW.y;
        const safeW = canvasW * PHOTO_WINDOW.w;
        const safeH = canvasH * PHOTO_WINDOW.h;

        // Process user image to fit safe area exactly
        const processedPortrait = await sharp(imageBuffer)
            .rotate() // tự xoay đúng chiều theo EXIF (ảnh chụp điện thoại)
            .resize(Math.floor(safeW), Math.floor(safeH), { fit: 'cover', position: 'center' })
            .toBuffer();

        const portraitImg = await loadImage(processedPortrait);

        // Draw the user portrait first
        ctx.drawImage(portraitImg, safeX, safeY, safeW, safeH);

        // Draw the frame OVER the portrait using multiply blend mode!
        // This makes white areas of the frame transparent, leaving black borders visible on top of the portrait.
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(frameImg, 0, 0, canvasW, canvasH);
        ctx.globalCompositeOperation = 'source-over'; // reset

        // Nameplate always has a fixed height
        const plateHeight = NAMEPLATE_HEIGHT;
        const plateY = safeY + safeH - plateHeight;

        // Solid light green background for readability
        ctx.fillStyle = '#4B8540';
        ctx.fillRect(safeX, plateY, safeW, plateHeight);

        // Chữ trên biển tên: chỉ in thông tin có thật (bỏ các câu kiểu "không rõ năm sinh...").
        // Dòng nào thiếu dữ liệu thì bỏ; các dòng còn lại được căn giữa theo chiều dọc.
        const lines = [
            { text: buildNameLine(data.huongLinh), weight: 'bold', size: 55, color: '#FFD700' },
            { text: buildYearsLine(data.namSinh, data.namMatDuongLich, data.namMatAmLich), weight: 'normal', size: 35, color: '#FFFFFF' },
            { text: buildAgeLine(data.huongTho), weight: 'normal', size: 40, color: '#FFD700' },
        ].filter((line) => line.text);

        // Chữ dài thì thu nhỏ dần cho vừa băng tên (không để tràn khung).
        const maxTextWidth = safeW - 60;
        for (const line of lines) {
            while (line.size > 26) {
                ctx.font = `${line.weight} ${line.size}px "Roboto", sans-serif`;
                if (ctx.measureText(line.text).width <= maxTextWidth) break;
                line.size -= 2;
            }
        }

        const lineGap = 1.3;
        const totalHeight = lines.reduce((sum, line) => sum + line.size * lineGap, 0);
        let cursorY = plateY + (plateHeight - totalHeight) / 2;
        ctx.textAlign = 'center';
        for (const line of lines) {
            ctx.font = `${line.weight} ${line.size}px "Roboto", sans-serif`;
            ctx.fillStyle = line.color;
            ctx.fillText(line.text, canvasW / 2, cursorY + line.size, maxTextWidth);
            cursorY += line.size * lineGap;
        }

        // Final Composite Image Buffer
        const finalImageBuffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
        // (In a real app, this finalImageBuffer gets uploaded to Drive)

        // 2. Upload images and data via Google Apps Script Proxy
        console.log('Sending data to Google Apps Script...');

        // Cấu trúc dữ liệu theo form được yêu cầu
        const randomId = Math.floor(Math.random() * 900) + 100; // 3-digit random number
        const payload = {
            baseFileName: data.huongLinh ? `${data.huongLinh}_${randomId}` : `HuongLinh_${randomId}`,
            originalImageBase64: originalBuffer.toString('base64'),
            framedImageBase64: finalImageBuffer.toString('base64'),

            traiChu: data.traiChu || '',
            phapDanhTraiChu: data.phapDanhTraiChu || '',
            tuoiTraiChu: data.tuoiTraiChu || '',
            diaChi: data.diaChi || '',
            huongLinh: data.huongLinh || '',
            phapDanhHuongLinh: data.phapDanhHuongLinh || '',
            namSinh: data.namSinh || '',
            namMatDuongLich: data.namMatDuongLich || '',
            namMatAmLich: data.namMatAmLich || '',
            gioMat: data.gioMat || '',
            huongTho: data.huongTho || '',
            noiAnTang: data.noiAnTang || '',
            tomTatTieuSu: data.tomTatTieuSu || '',
            thoiGianKyGui: data.thoiGianKyGui === 'khongThoiHan' ? 'Không thời hạn' : 'Có thời hạn',
            ngayDangKy: data.ngayDangKy || new Date().toLocaleString('vi-VN')
        };
        const scriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
        if (!scriptUrl) {
            throw new Error('Server Configuration Error: Missing GOOGLE_APPS_SCRIPT_URL');
        }
        const response = await fetch(scriptUrl, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' },
            // Cần cho Apps Script vì nó tự redirect (Follow redirects)
            redirect: 'follow',
        });

        const resultText = await response.text();
        let result;
        try {
            result = JSON.parse(resultText);
        } catch (e) {
            console.error('GAS Error Response:', resultText);
            throw new Error('Failed to parse response from Google Apps Script');
        }

        if (!result.success) {
            console.error('GAS Error:', result.error);
            throw new Error(result.error || 'Google Apps Script failed processing');
        }

        console.log(`Successfully processed and uploaded via Apps Script.`);

        return NextResponse.json({
            success: true,
            message: 'Processing and upload completed successfully',
            framedUrl: result.framedUrl,
            originalUrl: result.originalUrl,
            // Ảnh thờ có khung trả thẳng về để gia đình xem và tải ngay (~1 MB)
            framedImage: `data:image/jpeg;base64,${finalImageBuffer.toString('base64')}`,
        });

    } catch (error) {
        console.error('Error processing submission:', error);
        let errorStack = '';
        if (error instanceof Error) {
            console.error(error.stack);
            errorStack = error.stack || error.message;
        }
        return NextResponse.json({ error: 'Internal Server Error', details: errorStack }, { status: 500 });
    }
}
