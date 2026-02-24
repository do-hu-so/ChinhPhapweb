const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { createCanvas, loadImage } = require('canvas');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

async function testLogic() {
    try {
        console.log("Loading image...");
        const imageBuffer = fs.readFileSync('F:\\Chinhphap\\image_test\\a.jpg');

        console.log("Processing with sharp...");
        const portraitWidth = 1600;
        const portraitHeight = 2100;
        const processedPortrait = await sharp(imageBuffer)
            .resize(portraitWidth, portraitHeight, { fit: 'cover', position: 'center' })
            .toBuffer();

        console.log("Canvas setup...");
        const canvasW = 2000;
        const canvasH = 3000;
        const canvas = createCanvas(canvasW, canvasH);
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#FFFDF5';
        ctx.fillRect(0, 0, canvasW, canvasH);

        const portraitImg = await loadImage(processedPortrait);
        ctx.drawImage(portraitImg, 200, 200, portraitWidth, portraitHeight);

        console.log("Canvas rendering done.");
        const finalImageBuffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });

        console.log("Making docx...");
        const templatePath = path.resolve('src/app/api/submit/template/template.docx');
        const content = fs.readFileSync(templatePath, 'binary');
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
        doc.render({ huongLinh: "TEST" });
        const docxBuffer = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });

        console.log("All success!");
    } catch (e) {
        console.error("FAILED CAUSE:");
        console.error(e);
    }
}
testLogic();
