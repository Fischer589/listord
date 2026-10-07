import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import nextConfig from "../next.config.mjs";

const require = createRequire(import.meta.url);
const { default: Image } = require("next/image");
const { ImageConfigContext } = require("next/dist/shared/lib/image-config-context.shared-runtime");
const { imageConfigDefault } = require("next/dist/shared/lib/image-config");

const sources = [
  "https://photos.example.supabase.co/storage/v1/object/public/worker-photos/fixture/1720000000000-uuid.jpg",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80"
];
const surfaces = [
  { name: "worker card", sizes: "(min-width: 1024px) 320px, (min-width: 768px) 300px, 85vw", priority: false },
  { name: "worker profile", sizes: "(max-width: 768px) 100vw, 380px", priority: true },
  { name: "admin thumbnail", sizes: "64px", unoptimized: true }
];

for (const surface of surfaces) {
  for (const src of sources) {
    test(`${surface.name} serves ${new URL(src).hostname} directly with responsive fill`, () => {
      const { name, ...props } = surface;
      const html = renderToStaticMarkup(
        React.createElement(ImageConfigContext.Provider, {
          value: { ...imageConfigDefault, ...nextConfig.images }
        }, React.createElement(Image, { ...props, src, alt: "Foto de Ana", fill: true }))
      );
      const img = html.match(/<img\b[^>]*>/)?.[0];
      assert.ok(img, "photo remains rendered");
      assert.ok(img.includes(`src="${src.replaceAll("&", "&amp;")}"`), "original URL and query parameters are preserved");
      assert.doesNotMatch(html, /\/_next\/image|srcSet=|imageSrcSet=/i, "no optimizer URLs or variant candidates, including preloads");
      assert.match(img, /alt="Foto de Ana"/);
      assert.match(img, /position:absolute/);
      assert.match(img, /height:100%/);
      assert.match(img, /width:100%/);
      if (props.priority) assert.doesNotMatch(img, /loading="lazy"/);
      else assert.match(img, /loading="lazy"/);
    });
  }
}
