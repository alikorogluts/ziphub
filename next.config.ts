/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // HTML çıktısı verir (Electron için şart)
  distDir: 'out',   // Çıktı klasörü 'out' olacak
  images: {
    unoptimized: true, // Masaüstünde resim optimizasyonu çalışmaz
  },
};

export default nextConfig;