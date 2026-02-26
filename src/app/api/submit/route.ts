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
        const safeX = canvasW * 0.208; // slightly less than 0.2116 to move left
        const safeY = canvasH * 0.1392;
        const safeW = canvasW * 0.59; // slightly more than 0.5865 to be wider
        const safeH = canvasH * 0.6745;

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

        // Calculate dynamic plate height if there is tieuSu
        let textLines: string[] = [];
        if (data.tomTatTieuSu) {
            ctx.font = 'normal 40px "Roboto", sans-serif';
            const paragraphs = data.tomTatTieuSu.split('\n');
            const maxWidth = safeW - 80;
            paragraphs.forEach(paragraph => {
                const words = paragraph.split(' ');
                let line = '';
                for (let n = 0; n < words.length; n++) {
                    const testLine = line + words[n] + ' ';
                    const metrics = ctx.measureText(testLine);
                    if (metrics.width > maxWidth && n > 0) {
                        textLines.push(line.trim());
                        line = words[n] + ' ';
                    } else {
                        line = testLine;
                    }
                }
                if (line) textLines.push(line.trim());
            });
        }

        const tieuSuHeight = textLines.length > 0 ? textLines.length * 35 : 0;
        let plateHeight = 175 + tieuSuHeight;
        // Keep some bottom padding
        if (textLines.length > 0) {
            plateHeight += 20; // Extra padding at the bottom
        }
        const plateY = safeY + safeH - plateHeight;

        // Solid light green background for readability
        ctx.fillStyle = '#4B8540';
        ctx.fillRect(safeX, plateY, safeW, plateHeight);

        // Add Text to Nameplate
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFD700'; // Gold text

        ctx.font = 'bold 55px "Roboto", sans-serif';

        // Auto-prepend "HƯƠNG LINH " if it doesn't exist
        let huongLinhName = (data.huongLinh || '').trim().toUpperCase();
        if (huongLinhName && !huongLinhName.includes('HƯƠNG LINH')) {
            huongLinhName = `HƯƠNG LINH ${huongLinhName}`;
        } else if (!huongLinhName) {
            huongLinhName = 'HƯƠNG LINH';
        }

        ctx.fillText(huongLinhName, canvasW / 2, plateY + 60);

        ctx.font = 'normal 35px "Roboto", sans-serif';
        ctx.fillStyle = '#FFFFFF';

        const birthYear = data.namSinh ? `Sinh năm: ${data.namSinh}` : '';

        let deathYear = '';
        if (data.namMatDuongLich && data.namMatAmLich) {
            deathYear = `Mất năm: ${data.namMatDuongLich} (${data.namMatAmLich})`;
        } else if (data.namMatDuongLich) {
            deathYear = `Mất năm: ${data.namMatDuongLich}`;
        } else if (data.namMatAmLich) {
            // Just in case they only provide lunar year
            deathYear = `Mất năm: ${data.namMatAmLich}`;
        }

        const yearsInfo = [birthYear, deathYear].filter(Boolean).join(' - ');

        if (yearsInfo) {
            ctx.fillText(yearsInfo, canvasW / 2, plateY + 110);
        }

        if (data.huongTho) {
            ctx.fillStyle = '#FFD700';
            ctx.font = 'normal 40px "Roboto", sans-serif';

            let huongThoText = data.huongTho.trim();
            // Nếu người dùng không nhập chữ "hưởng" (chỉ nhập số "34" hoặc "34 tuổi")
            if (!huongThoText.toLowerCase().includes('hưởng')) {
                const ageMatch = huongThoText.match(/\d+/);
                const age = ageMatch ? parseInt(ageMatch[0]) : 0;
                // Nhỏ hơn bằng 60 thường dùng Hưởng dương, ngược lại là Hưởng thọ
                const prefix = (age > 0 && age <= 60) ? 'Hưởng dương' : 'Hưởng thọ';
                const suffix = !huongThoText.toLowerCase().includes('tuổi') ? ' tuổi' : '';
                huongThoText = `${prefix}: ${huongThoText}${suffix}`;
            }

            ctx.fillText(huongThoText, canvasW / 2, plateY + 160);
        }

        // Draw tomTatTieuSu lines
        if (textLines.length > 0) {
            ctx.fillStyle = '#FFFFFF';
            // Use lighter and smaller font for the summary
            ctx.font = 'normal 30px "Roboto", sans-serif';
            let currentY = plateY + 205; // Starting Y below huongTho
            textLines.forEach(line => {
                ctx.fillText(line, canvasW / 2, currentY);
                currentY += 35; // Line height
            });
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
