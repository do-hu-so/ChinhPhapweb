// Chuẩn hoá chữ in lên ảnh thờ: chỉ in thông tin có thật (năm, can chi, số tuổi),
// bỏ qua những câu như "không rõ năm sinh..." mà gia đình gõ vào ô.
// Google Sheet vẫn lưu nguyên văn những gì gia đình nhập.

const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Mẹo', 'Thìn', 'Tỵ', 'Tị', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];

const lower = (s: string) => s.normalize('NFC').toLocaleLowerCase('vi');

/** Năm 4 chữ số (1800–2099) đầu tiên trong chuỗi, không có thì trả ''. */
export function extractYear(value?: string): string {
    const m = (value || '').match(/(?<!\d)(1[89]\d{2}|20\d{2})(?!\d)/);
    return m ? m[1] : '';
}

/** Cặp can chi hợp lệ (vd "Canh Tuất") trong chuỗi, không có thì trả ''. */
export function extractCanChi(value?: string): string {
    const words = (value || '').normalize('NFC').split(/[^\p{L}]+/u).filter(Boolean);
    for (let i = 0; i < words.length - 1; i++) {
        const can = CAN.find((c) => lower(c) === lower(words[i]));
        const chi = CHI.find((c) => lower(c) === lower(words[i + 1]));
        if (can && chi) return `${can} ${chi}`;
    }
    return '';
}

/** "Hưởng thọ/dương: N tuổi" khi có số tuổi hợp lệ (1–130), ngược lại trả ''. */
export function buildAgeLine(value?: string, thoFrom = 61): string {
    const s = lower(value || '');
    const m = s.match(/\d+/);
    if (!m) return '';
    const age = parseInt(m[0], 10);
    if (!age || age > 130) return '';
    let prefix = age >= thoFrom ? 'Hưởng thọ' : 'Hưởng dương';
    if (s.includes('hưởng dương')) prefix = 'Hưởng dương';
    else if (s.includes('hưởng thọ')) prefix = 'Hưởng thọ';
    return `${prefix}: ${age} tuổi`;
}

/** Dòng năm sinh – năm mất; thiếu phần nào thì bỏ phần đó, thiếu cả hai thì trả ''. */
export function buildYearsLine(namSinh?: string, namMatDuongLich?: string, namMatAmLich?: string): string {
    const birth = extractYear(namSinh);
    const deathYear = extractYear(namMatDuongLich);
    const deathCanChi = extractCanChi(namMatAmLich);

    const parts: string[] = [];
    if (birth) parts.push(`Sinh năm: ${birth}`);
    if (deathYear && deathCanChi) parts.push(`Mất năm: ${deathYear} (${deathCanChi})`);
    else if (deathYear) parts.push(`Mất năm: ${deathYear}`);
    else if (deathCanChi) parts.push(`Mất năm: ${deathCanChi}`);
    return parts.join(' - ');
}

/** "HƯƠNG LINH <TÊN IN HOA>", không lặp tiền tố nếu gia đình đã gõ sẵn. */
export function buildNameLine(huongLinh?: string): string {
    const name = (huongLinh || '').normalize('NFC').trim().toLocaleUpperCase('vi');
    if (!name) return 'HƯƠNG LINH';
    return name.startsWith('HƯƠNG LINH') ? name : `HƯƠNG LINH ${name}`;
}
