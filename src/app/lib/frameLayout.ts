// Bố cục khung ảnh thờ image/khung_tho_2.png (931 x 1315 px), dùng chung cho server (ghép khung)
// và trình duyệt (cắt ảnh trước cho vừa ô ảnh). Đổi file khung thì phải đo và sửa lại các số này.

export const FRAME_SIZE = { w: 931, h: 1315 };

// Ô đặt di ảnh, tính theo tỉ lệ kích thước khung.
export const PHOTO_WINDOW = { x: 0.208, y: 0.1392, w: 0.59, h: 0.6745 };

// Băng tên màu xanh lá đè lên đáy ô ảnh (px trên ảnh xuất ra gấp đôi khung).
export const NAMEPLATE_HEIGHT = 220;

/** Tỉ lệ rộng / cao của ô ảnh (~0,62). Ảnh cắt đúng tỉ lệ này sẽ không bị server cắt thêm. */
export const PHOTO_WINDOW_ASPECT = (PHOTO_WINDOW.w * FRAME_SIZE.w) / (PHOTO_WINDOW.h * FRAME_SIZE.h);
