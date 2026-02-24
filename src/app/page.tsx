import { Metadata } from 'next';
import FormContainer from './components/FormContainer';

export const metadata: Metadata = {
  title: 'Mẫu đăng ký ký gửi Hương Linh',
  description: 'Biểu mẫu đăng ký làm lễ cúng và ký gửi Hương Linh tại chùa.',
};

export default function Home() {
  return (
    <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-3xl w-full">
        {/* Header Section */}
        <div className="text-center mb-10">
          <div className="inline-block p-4 rounded-full bg-orange-100 mb-4 shadow-sm border border-orange-200">
            {/* Minimalist Lotus SVG for decoration */}
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 22C12 22 17 18 19 13C20.6667 8.83333 19 5 19 5C19 5 15.5 5 12 11C8.5 5 5 5 5 5C5 5 3.33333 8.83333 5 13C7 18 12 22 12 22Z" fill="#FF9A00" fillOpacity="0.8" />
              <path d="M12 22C12 22 14 17 14 12C14 7 12 3 12 3C12 3 10 7 10 12C10 17 12 22 12 22Z" fill="#FFC837" fillOpacity="0.9" />
              <path d="M12 22C12 22 7.5 19.5 5.5 15.5C3.5 11.5 3 7 3 7C3 7 7 8 9.5 13C11 16 12 22 12 22Z" fill="#FF9A00" fillOpacity="0.6" />
              <path d="M12 22C12 22 16.5 19.5 18.5 15.5C20.5 11.5 21 7 21 7C21 7 17 8 14.5 13C13 16 12 22 12 22Z" fill="#FF9A00" fillOpacity="0.6" />
            </svg>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif text-buddhist-dark md:leading-tight mb-3">
            Mẫu đăng ký <br />
            <span className="text-buddhist-orange font-bold text-4xl sm:text-5xl md:text-6xl mt-2 block drop-shadow-sm">
              Ký gửi Hương Linh
            </span>
          </h1>
          <p className="text-buddhist-frame max-w-xl mx-auto italic">
            Thành tâm thành ý, nguyện cầu siêu độ. Vui lòng điền đầy đủ thông tin bên dưới.
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-orange-100 overflow-hidden">
          <div className="h-2 w-full bg-gradient-to-r from-buddhist-yellow via-buddhist-orange to-buddhist-red"></div>
          <div className="p-6 sm:p-10">
            <FormContainer />
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-buddhist-frame/70 text-sm">
          <p>Trang web phục vụ đăng ký tự động và xử lý tạo ảnh Di Ảnh chuẩn.</p>
        </div>
      </div>
    </main>
  );
}
