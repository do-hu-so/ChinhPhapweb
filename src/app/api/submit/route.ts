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
        // - Resize to fit within 20x30 proportion frame
        // - Add a name plate at the bottom with the Huong Linh information
        const imageBuffer = Buffer.from(await imageFile.arrayBuffer());

        // Process user image: resize so it perfectly fits inside the inner frame
        const portraitWidth = 1600;
        const portraitHeight = 2100;
        const processedPortrait = await sharp(imageBuffer)
            .resize(portraitWidth, portraitHeight, { fit: 'cover', position: 'center' })
            .toBuffer();

        // Canvas Setup (2000x3000)
        const canvasW = 2000;
        const canvasH = 3000;
        const canvas = createCanvas(canvasW, canvasH);
        const ctx = canvas.getContext('2d');

        // Draw Background (White/Cream)
        ctx.fillStyle = '#FFFDF5';
        ctx.fillRect(0, 0, canvasW, canvasH);

        // Draw Buddhist Frame (Simple elegant borders)
        ctx.lineWidth = 40;
        ctx.strokeStyle = '#8D6E63'; // Brown border
        ctx.strokeRect(60, 60, canvasW - 120, canvasH - 120);

        ctx.lineWidth = 15;
        ctx.strokeStyle = '#FFC837'; // Gold inner border
        ctx.strokeRect(120, 120, canvasW - 240, canvasH - 240);

        // Draw uploaded portrait
        const portraitImg = await loadImage(processedPortrait);
        // Center the portrait horizontally, shift up slightly to leave room for the nameplate
        const portraitX = (canvasW - portraitWidth) / 2;
        const portraitY = 200;
        ctx.drawImage(portraitImg, portraitX, portraitY, portraitWidth, portraitHeight);

        // Add a gradient or solid blue nameplate at the bottom
        ctx.fillStyle = '#0F3057'; // Deep solemn blue
        const plateHeight = 450;
        const plateY = canvasH - 120 - plateHeight - 50;
        const plateX = 200;
        const plateW = canvasW - 400;
        ctx.fillRect(plateX, plateY, plateW, plateHeight);

        // Inner gold border for the plate
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#FFC837';
        ctx.strokeRect(plateX + 10, plateY + 10, plateW - 20, plateHeight - 20);

        // Add Text to Nameplate
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFC837'; // Gold text

        ctx.font = 'bold 90px sans-serif';
        ctx.fillText(data.huongLinh?.toUpperCase() || 'HƯƠNG LINH', canvasW / 2, plateY + 130);

        ctx.font = '60px sans-serif';
        ctx.fillStyle = '#FFFFFF';

        const birthYear = data.namSinh ? `Sinh năm: ${data.namSinh}` : '';
        const deathYear = data.namMatDuongLich ? `Mất năm: ${data.namMatDuongLich}` : '';
        const yearsInfo = [birthYear, deathYear].filter(Boolean).join(' - ');

        if (yearsInfo) {
            ctx.fillText(yearsInfo, canvasW / 2, plateY + 250);
        }

        if (data.huongTho) {
            ctx.fillStyle = '#FFC837';
            ctx.fillText(data.huongTho, canvasW / 2, plateY + 360);
        }

        // Final Composite Image Buffer
        const finalImageBuffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
        // (In a real app, this finalImageBuffer gets uploaded to Drive)

        // 2. Upload images and data via Google Apps Script Proxy
        console.log('Sending data to Google Apps Script...');

        // Cấu trúc dữ liệu theo form được yêu cầu
        const payload = {
            baseFileName: data.huongLinh || `HuongLinh_${Date.now()}`,
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
