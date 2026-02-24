import * as fs from "fs";
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from "docx";

const doc = new Document({
    sections: [
        {
            properties: {},
            children: [
                new Paragraph({
                    text: "MẪU ĐĂNG KÝ HƯƠNG LINH",
                    heading: HeadingLevel.HEADING_1,
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400 }
                }),
                new Paragraph({
                    children: [
                        new TextRun({ text: "I. Thông tin Trai Chủ", bold: true, size: 28 })
                    ],
                    spacing: { before: 200, after: 120 }
                }),
                new Paragraph({ text: "Tên Trai Chủ: {{traiChu}}" }),
                new Paragraph({ text: "Pháp Danh: {{phapDanhTraiChu}}" }),
                new Paragraph({ text: "Tuổi: {{tuoiTraiChu}}" }),
                new Paragraph({ text: "Địa Chỉ: {{diaChi}}" }),

                new Paragraph({
                    children: [
                        new TextRun({ text: "II. Thông tin Hương Linh", bold: true, size: 28 })
                    ],
                    spacing: { before: 200, after: 120 }
                }),
                new Paragraph({ text: "Tên Hương Linh: {{huongLinh}}" }),
                new Paragraph({ text: "Pháp Danh Hương Linh: {{phapDanhHuongLinh}}" }),
                new Paragraph({ text: "Năm Sinh: {{namSinh}}" }),
                new Paragraph({ text: "Giờ mất: {{gioMat}}" }),
                new Paragraph({ text: "Năm mất Dương lịch: {{namMatDuongLich}}" }),
                new Paragraph({ text: "Năm mất Âm lịch: {{namMatAmLich}}" }),
                new Paragraph({ text: "Hưởng thọ/dương: {{huongTho}}" }),
                new Paragraph({ text: "Nơi An táng: {{noiAnTang}}" }),

                new Paragraph({
                    children: [
                        new TextRun({ text: "III. Thời gian và Khác", bold: true, size: 28 })
                    ],
                    spacing: { before: 200, after: 120 }
                }),
                new Paragraph({ text: "Ngày đăng ký: {{ngayDangKy}}" }),
                new Paragraph({ text: "Thời gian ký gửi: {{thoiGianKyGui}}" }),
            ],
        },
    ],
});

Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync("src/app/api/submit/template/template.docx", buffer);
    console.log("Template generated successfully!");
});
