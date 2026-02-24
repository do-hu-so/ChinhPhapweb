import { Metadata } from 'next';
import Image from 'next/image';
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
          <div className="inline-block p-2 rounded-full bg-white mb-4 shadow-sm border border-orange-200 overflow-hidden">
            {/* Using the avata.jpg image as requested */}
            <Image
              src="/avata.jpg"
              alt="Logo"
              width={64}
              height={64}
              className="rounded-full object-cover w-16 h-16"
            />
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
          <p>Trang web phục vụ đăng ký tự động của Thiền Viện Trúc Lâm Chính Pháp - Tuyên Quang.</p>
        </div>
      </div>
    </main>
  );
}
