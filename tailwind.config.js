/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        buddhist: {
          orange: '#FF9A00', /* Vàng cam đậm */
          yellow: '#FFC837', /* Vàng sáng */
          red: '#D32F2F',    /* Đỏ nâu trầm */
          bg: '#FFFDF5',     /* Nền trắng kem nhẹ */
          dark: '#3E2723',   /* Chữ nâu đậm đen */
          frame: '#8D6E63',  /* Nâu khung tranh */
        }
      },
      backgroundImage: {
        'lotus-pattern': "url('/lotus-bg.png')",
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      }
    },
  },
  plugins: [],
};
