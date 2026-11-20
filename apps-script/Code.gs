/**
 * Apps Script nhận dữ liệu "Ký gửi Hương Linh" từ web (src/app/api/submit/route.ts).
 *  - Lưu ảnh gốc + ảnh có khung vào thư mục Google Drive FOLDER_NAME
 *    (PUBLIC_IMAGES = true: ai có link ảnh đều xem được).
 *  - Ghi 1 dòng vào Google Sheet theo TÊN CỘT ở dòng 1 (đổi thứ tự cột không bị lệch).
 *  - Trả JSON { success, framedUrl, originalUrl } đúng như route.ts đang chờ.
 *
 * CÀI ĐẶT (làm bằng tài khoản Google sở hữu sheet "ho_so"):
 *  1. Mở sheet "ho_so" → menu Tiện ích mở rộng (Extensions) → Apps Script.
 *  2. Xoá code mẫu, dán toàn bộ file này, bấm Lưu.
 *  3. Chọn hàm kiemTraCaiDat → Chạy → cấp quyền (Sheets + Drive). Xem Nhật ký thực thi.
 *  4. Triển khai (Deploy) → Tùy chọn triển khai mới (New deployment) → loại "Ứng dụng web":
 *       Thực thi với tư cách (Execute as): Tôi (Me)
 *       Ai có quyền truy cập (Who has access): Bất kỳ ai (Anyone)
 *     → Triển khai → copy URL dạng https://script.google.com/macros/s/.../exec
 *  5. Đặt URL đó vào biến GOOGLE_APPS_SCRIPT_URL trên Vercel rồi deploy lại web.
 *
 * Không ghi mã Google Sheet vào code vì repo công khai: script gắn với sheet nên tự biết sheet nào.
 * (Nếu tạo script độc lập, đặt Script Property SHEET_ID = mã sheet.)
 */

var SHEET_NAME = 'Trang tính1'; // tab nhận dữ liệu; không thấy thì dùng tab đầu tiên
var FOLDER_NAME = 'Ảnh hương linh (ho_so)';
var MAX_TEXT = 5000; // giới hạn độ dài mỗi ô
// true: ai có link ảnh đều xem được (không cần đăng nhập). false: chỉ người được chia sẻ thư mục mới xem.
var PUBLIC_IMAGES = true;

// Tên cột trên Sheet → tên trường web gửi lên
var COLUMN_MAP = {
  'Trai Chủ': 'traiChu',
  'Pháp Danh': 'phapDanhTraiChu',
  'Tuổi Trai chủ': 'tuoiTraiChu',
  'Địa chỉ': 'diaChi',
  'Tên Hương Linh': 'huongLinh',
  'Pháp Danh HL': 'phapDanhHuongLinh',
  'Năm sinh HL': 'namSinh',
  'Năm mất-DL': 'namMatDuongLich',
  'Năm mất-AL': 'namMatAmLich',
  'Giờ mất': 'gioMat',
  'Hưởng Thọ': 'huongTho',
  'Nơi an Táng': 'noiAnTang',
  'Ảnh Gốc': 'originalUrl',
  'Ảnh Có Khung': 'framedUrl',
  'Thời hạn': 'thoiGianKyGui',
  'Thời gian đăng kí': 'ngayDangKy',
  'Tóm tắt tiểu sử': 'tomTatTieuSu',
};

/** Kiểm tra web app có truy cập được không (không ghi dữ liệu). */
function doGet() {
  return json_({ ok: true, service: 'dang-ky-huong-linh' });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) throw new Error('Không có dữ liệu gửi lên');
    var data = JSON.parse(e.postData.contents);
    if (!data.huongLinh && !data.traiChu) throw new Error('Thiếu tên hương linh và tên trai chủ');

    var folder = getFolder_();
    var stamp = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'yyyyMMdd-HHmmss');
    var base = stamp + '_' + safeName_(data.baseFileName || data.huongLinh || 'HuongLinh');

    var originalUrl = data.originalImageBase64 ? saveImage_(folder, data.originalImageBase64, base + '_goc') : '';
    var framedUrl = data.framedImageBase64 ? saveImage_(folder, data.framedImageBase64, base + '_khung') : '';

    var row = {};
    Object.keys(data).forEach(function (k) {
      if (k !== 'originalImageBase64' && k !== 'framedImageBase64') row[k] = data[k];
    });
    row.originalUrl = originalUrl;
    row.framedUrl = framedUrl;
    appendRow_(row);

    return json_({ success: true, framedUrl: framedUrl, originalUrl: originalUrl });
  } catch (err) {
    console.error(err);
    return json_({ success: false, error: String((err && err.message) || err) });
  }
}

/** Chạy tay 1 lần để cấp quyền và kiểm tra cấu hình (không ghi dòng nào). */
function kiemTraCaiDat() {
  var sheet = getSheet_();
  var folder = getFolder_();
  var headers = readHeaders_(sheet);
  var matched = headers.filter(function (h) { return !!lookup_()[norm_(h)]; });
  Logger.log('Sheet: %s / tab: %s', sheet.getParent().getName(), sheet.getName());
  Logger.log('Khớp %s/%s cột: %s', matched.length, Object.keys(COLUMN_MAP).length, matched.join(' | '));
  Logger.log('Thư mục ảnh: %s', folder.getUrl());
}

// ---------- helpers ----------

function getSheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Script chưa gắn với Google Sheet: hãy tạo từ menu Tiện ích mở rộng → Apps Script của sheet, hoặc đặt Script Property SHEET_ID.');
  }
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

function getFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('FOLDER_ID');
  if (id) {
    try {
      var saved = DriveApp.getFolderById(id);
      if (!saved.isTrashed()) return saved;
    } catch (e) { /* thư mục đã bị xoá → tạo lại */ }
  }
  var it = DriveApp.getFoldersByName(FOLDER_NAME);
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
  props.setProperty('FOLDER_ID', folder.getId());
  return folder;
}

function saveImage_(folder, base64, name) {
  var bytes = Utilities.base64Decode(base64);
  var isPng = bytes.length > 1 && bytes[0] === -119 && bytes[1] === 80; // 0x89 'P'
  var blob = Utilities.newBlob(bytes, isPng ? 'image/png' : 'image/jpeg', name + (isPng ? '.png' : '.jpg'));
  var file = folder.createFile(blob);
  if (PUBLIC_IMAGES) makePublic_(file);
  return file.getUrl();
}

/** Cho phép bất kỳ ai có link xem ảnh. Lỗi chia sẻ không làm hỏng việc đăng ký. */
function makePublic_(file) {
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return true;
  } catch (err) {
    console.error('Không chia sẻ công khai được ' + file.getName() + ': ' + err);
    return false;
  }
}

/** Chạy tay 1 lần: mở công khai (ai có link đều xem) cho toàn bộ ảnh ĐÃ có trong thư mục. */
function chiaSeCongKhaiAnhDaCo() {
  var files = getFolder_().getFiles();
  var ok = 0, fail = 0;
  while (files.hasNext()) {
    if (makePublic_(files.next())) ok++; else fail++;
  }
  Logger.log('Đã mở công khai %s ảnh, lỗi %s ảnh', ok, fail);
}

function appendRow_(row) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getSheet_();
    var headers = readHeaders_(sheet);
    var map = lookup_();
    var matched = 0;
    var values = headers.map(function (h) {
      var key = map[norm_(h)];
      if (!key) return '';
      matched++;
      return clean_(row[key]);
    });
    if (!matched) throw new Error('Không khớp tên cột nào ở dòng 1 của tab "' + sheet.getName() + '"');

    var range = sheet.getRange(sheet.getLastRow() + 1, 1, 1, values.length);
    range.setNumberFormat('@'); // giữ nguyên dạng chữ: "10:30", số 0 đầu, năm...
    range.setValues([values]);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

function readHeaders_(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    var defaults = Object.keys(COLUMN_MAP);
    sheet.getRange(1, 1, 1, defaults.length).setValues([defaults]);
    return defaults;
  }
  return sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
}

function lookup_() {
  var map = {};
  Object.keys(COLUMN_MAP).forEach(function (h) { map[norm_(h)] = COLUMN_MAP[h]; });
  return map;
}

function norm_(s) {
  return String(s || '').normalize('NFC').trim().toLowerCase();
}

function clean_(v) {
  var s = v === undefined || v === null ? '' : String(v).normalize('NFC').trim();
  if (s.length > MAX_TEXT) s = s.slice(0, MAX_TEXT);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // chặn chèn công thức
  return s;
}

function safeName_(s) {
  return String(s).normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 80) || 'HuongLinh';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
