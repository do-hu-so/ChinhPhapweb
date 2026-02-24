import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
// import { google } from 'googleapis'; // Removed, now using Apps Script
import sharp from 'sharp';
import { createCanvas, loadImage, registerFont } from 'canvas';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const imageFile = formData.get('image') as File;

        if (!imageFile) {
            return NextResponse.json({ error: 'No image provided' }, { status: 400 });
        }

        // Extract all text fields
        const data: Record<string, string> = {};
        formData.forEach((value, key) => {
            if (key !== 'image') {
                data[key] = value.toString();
            }
        });

        console.log('Received submission for:', data.huongLinh);

        // 1. Image Compositing with Sharp and Canvas
        const imageBuffer = Buffer.from(await imageFile.arrayBuffer());

        // Load the template frame from public/khung.jpg
        const framePath = path.join(process.cwd(), 'public', 'khung.jpg');
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

        // Determine safe inner area for the portrait (~11% bounds based on template analysis)
        const safeX = canvasW * 0.11;
        const safeY = canvasH * 0.11;
        const safeW = canvasW * 0.78;
        const safeH = canvasH * 0.78;

        // Process user image to fit safe area exactly
        const processedPortrait = await sharp(imageBuffer)
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

        // Draw Text Background (Nameplate at the bottom of portrait)
        const plateHeight = 350;
        const plateY = safeY + safeH - plateHeight;

        // Semi-transparent dark background for readability
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(safeX, plateY, safeW, plateHeight);

        // Add Text to Nameplate
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFD700'; // Gold text

        ctx.font = 'bold 70px "Roboto", sans-serif';
        ctx.fillText(data.huongLinh?.toUpperCase() || 'HƯƠNG LINH', canvasW / 2, plateY + 110);

        ctx.font = 'normal 45px "Roboto", sans-serif';
        ctx.fillStyle = '#FFFFFF';

        const birthYear = data.namSinh ? `Sinh năm: ${data.namSinh}` : '';
        const deathYear = data.namMatDuongLich ? `Mất năm: ${data.namMatDuongLich}` : '';
        const yearsInfo = [birthYear, deathYear].filter(Boolean).join(' - ');

        if (yearsInfo) {
            ctx.fillText(yearsInfo, canvasW / 2, plateY + 210);
        }

        if (data.huongTho) {
            ctx.fillStyle = '#FFD700';
            ctx.font = 'normal 50px "Roboto", sans-serif';
            ctx.fillText(data.huongTho, canvasW / 2, plateY + 300);
        }

        // Final Composite Image Buffer
        const finalImageBuffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
        // (In a real app, this finalImageBuffer gets uploaded to Drive)

        // 2. Upload images and data via Google Apps Script Proxy
        console.log('Sending data to Google Apps Script...');

        // Cấu trúc dữ liệu theo form được yêu cầu
        const payload = {
            baseFileName: data.huongLinh ? `${data.huongLinh}_${Date.now()}` : `HuongLinh_${Date.now()}`,
            originalImageBase64: imageBuffer.toString('base64'),
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
