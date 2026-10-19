import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source:"/supplier/:path*",
        headers:[
          {key:"Referrer-Policy",value:"no-referrer"},
          {key:"Cache-Control",value:"no-store, private"},
          {key:"X-Robots-Tag",value:"noindex, nofollow, noarchive"},
          {key:"X-Content-Type-Options",value:"nosniff"},
        ],
      },
      {
        source:"/api/v1/supplier/:path*",
        headers:[
          {key:"Referrer-Policy",value:"no-referrer"},
          {key:"Cache-Control",value:"no-store, private"},
          {key:"X-Robots-Tag",value:"noindex, nofollow"},
        ],
      },
    ];
  },
};
export default nextConfig;
