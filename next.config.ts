import { resolve } from "node:path";
import type { NextConfig } from "next";

// 비주얼 회귀 빌드는 PORTFOLIO_CONTENT_DIR에 고정 fixture 디렉터리를 넘겨 @/content import를 통째로 바꾼다.
// tsconfig paths가 webpack alias보다 먼저 풀리므로 alias 대신 요청 문자열을 바꾼다.
const contentDirectory = process.env.PORTFOLIO_CONTENT_DIR;

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "standalone",
  webpack(config, { webpack }) {
    if (contentDirectory) {
      const absoluteContentDirectory = resolve(contentDirectory);

      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^@\/content\//,
          (resource: { request: string }) => {
            resource.request = resource.request.replace(
              /^@\/content/,
              absoluteContentDirectory,
            );
          },
        ),
      );
    }

    return config;
  },
};

export default nextConfig;
