const lowMemory = process.env.VITALE_LOW_MEMORY === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: false,
  webpack(config, { dev }) {
    if (dev && lowMemory) {
      // Su Node 32-bit la cache PackFile di Webpack puo richiedere ArrayBuffer
      // troppo grandi. In modalita low-memory la disabilitiamo completamente.
      config.cache = false;

      // Riduce il numero di moduli elaborati contemporaneamente e quindi i
      // picchi di memoria durante la compilazione in sviluppo.
      config.parallelism = 2;
    }

    return config;
  },
};

if (lowMemory) {
  console.log("[VITALE] Next.js low-memory mode attiva (32-bit): cache Webpack OFF, parallelismo 2");
}

export default nextConfig;
