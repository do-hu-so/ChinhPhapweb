const sharp = require('sharp');

async function run() {
    const { data, info } = await sharp('image/khung_tho_2.png')
        .raw()
        .toBuffer({ resolveWithObject: true });

    const cx = Math.floor(info.width / 2);
    const cy = Math.floor(info.height / 2);

    function getPixel(x, y) {
        if (x < 0 || x >= info.width || y < 0 || y >= info.height) return null;
        const i = (y * info.width + x) * info.channels;
        return {
            r: data[i],
            g: data[i + 1],
            b: data[i + 2],
            a: info.channels === 4 ? data[i + 3] : 255
        };
    }

    function isBlank(p) {
        if (!p) return false;
        // Check if transparent OR pure white
        if (p.a < 10) return true; // entirely transparent
        if (p.r > 240 && p.g > 240 && p.b > 240) return true; // practically white
        return false;
    }

    let left = cx;
    while (left > 0 && isBlank(getPixel(left, cy))) left--;

    let right = cx;
    while (right < info.width - 1 && isBlank(getPixel(right, cy))) right++;

    let top = cy;
    while (top > 0 && isBlank(getPixel(cx, top))) top--;

    let bottom = cy;
    while (bottom < info.height - 1 && isBlank(getPixel(cx, bottom))) bottom++;

    // Add 1px padding to avoid integer border color
    left += 1;
    right -= 1;
    top += 1;
    bottom -= 1;

    const boxW = right - left + 1;
    const boxH = bottom - top + 1;

    console.log(`Image Size: ${info.width}x${info.height}`);
    console.log(`Inner Bounding Box: X: ${left}, Y: ${top}, W: ${boxW}, H: ${boxH}`);
    console.log(`Percentages: X: ${(left / info.width).toFixed(4)}, Y: ${(top / info.height).toFixed(4)}, W: ${(boxW / info.width).toFixed(4)}, H: ${(boxH / info.height).toFixed(4)}`);
}

run().catch(console.error);
