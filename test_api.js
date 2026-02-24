const FormData = require('form-data');
const fs = require('fs');
const fetch = require('node-fetch');

async function testSubmit() {
    try {
        const form = new FormData();
        form.append('huongLinh', 'Test Error');
        form.append('image', fs.createReadStream('F:\\\\Chinhphap\\\\image_test\\\\a.jpg'));

        console.log('Sending request to 3000...');
        let response = await fetch('http://localhost:3000/api/submit', {
            method: 'POST',
            body: form,
            headers: form.getHeaders() // Crucial for multipart form-data
        });

        console.log('Status:', response.status);
        let resText = await response.text();
        console.log('Response:', resText);

    } catch (e) {
        console.error('Fatal Test Error:', e);
    }
}

testSubmit();
