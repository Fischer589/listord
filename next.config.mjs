const supabaseHostname = (() => {
  try {
    const value =
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
    return value ? new URL(value).hostname : undefined;
  } catch {
    return undefined;
  }
})();

const imageHosts = [
  "images.unsplash.com",
  ...(supabaseHostname ? [supabaseHostname] : [])
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // 4 MB photo + form fields, below Vercel's 4.5 MB request limit.
    serverActions: { bodySizeLimit: 4_400_000 }
  },
  images: {
    // Serve stable source URLs directly to avoid Vercel image transformations
    // and image-cache writes. next/image still preserves layout and lazy loading.
    unoptimized: true,
    remotePatterns: imageHosts.map((hostname) => ({
      protocol: "https",
      hostname
    }))
  },
  async headers() {
    return [{ source: "/trabajadores/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] }];
  },
  async redirects() {
    return [
      {
        source: "/busco-trabajo",
        destination: "/trabajadores/registro",
        permanent: true
      }
    ];
  }
};

export default nextConfig;
