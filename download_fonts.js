const fs = require('fs');
const https = require('https');
const path = require('path');

const fontsDir = path.join(__dirname, 'public', 'fonts');
if (!fs.existsSync(fontsDir)) {
    fs.mkdirSync(fontsDir, { recursive: true });
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 301 || response.statusCode === 302) {
                return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlinkSync(dest);
            reject(err);
        });
    });
}

const fontUrls = {
    'Roboto-Bold.ttf': 'https://github.com/googlefonts/roboto/raw/main/src/hinted/Roboto-Bold.ttf',
    'Roboto-Regular.ttf': 'https://github.com/googlefonts/roboto/raw/main/src/hinted/Roboto-Regular.ttf'
};

Promise.all(Object.entries(fontUrls).map(([filename, url]) => {
    const dest = path.join(fontsDir, filename);
    console.log(`Downloading ${filename}...`);
    return downloadFile(url, dest);
})).then(() => {
    console.log('Fonts downloaded successfully.');
}).catch((err) => {
    console.error('Error downloading fonts:', err);
});
