"use strict";

const cheerio = require("cheerio");

const sizes = [480, 720, 960, 1200, 1440];
const srcSizes = `(max-width: 720px) 100vw, 720px`;

module.exports = function htmlLazyImages(html) {
  const $ = cheerio.load(html);

  const $bodyImages = $(".post-content-body img");

  $bodyImages.each((i, el) => {
    const $el = $(el);
    $el.attr("loading", "lazy");
    const src = $el.attr("src");
    const url = new URL(src);

    if (url.hostname.includes("unsplash")) {
      const srcSet = sizes.map(w => makeUnsplashImage(src, w)).join(", ");
      $el.attr("src", makeUnsplashUrl(src, sizes[sizes.length - 1]));
      $el.attr("sizes", srcSizes);
      $el.attr("srcset", srcSet);
    } else if (url.hostname.includes("cloudinary")) {
      const originalSrc = $el.attr("src");
      const srcSet = sizes
        .map(w => makeCloudinaryImage(originalSrc, w))
        .join(", ");
      $el.attr("src", makeCloudinaryUrl(src, sizes[sizes.length - 1]));
      $el.attr("sizes", srcSizes);
      $el.attr("srcset", srcSet);
    } else if (
      url.hostname.includes("blog.boopathi.in") &&
      url.pathname.includes("apple-touch-icon")
    ) {
      /**
       * handle apple touch icon where ghost editor was being stupid
       */
      const newSrc = $el
        .attr("src")
        .replace(/apple-touch-icon-\d+x\d+.png/, "apple-touch-icon-60x60.png");
      $el.attr("src", newSrc);
    }
  });

  const $featureImages = $(".post-content-image img");
  $featureImages.each((i, el) => {
    const $el = $(el);
    $el.attr("loading", "lazy");
    const featureImageSizes = [480, 720, 960, 1200, 1440, 1600, 2000];

    const src = $el.attr("src");
    const srcSet = featureImageSizes
      .map(w => makeCloudinaryImage(src, w))
      .join(", ");

    $el.attr(
      "src",
      makeCloudinaryUrl(src, featureImageSizes[featureImageSizes.length - 1])
    );
    $el.attr("sizes", `(max-width: 720px) 100vw, 75vw`);
    $el.attr("srcset", srcSet);
  });

  const $postcardImages = $(".post-card-img");
  $postcardImages.each((i, el) => {
    const $el = $(el);
    $el.attr("loading", "lazy");
    const postcardImagesizes = [480, 720, 960, 1200];

    const src = $el.attr("src");
    const srcSet = postcardImagesizes
      .map(w => makeCloudinaryImage(src, w))
      .join(", ");

    $el.attr(
      "src",
      makeCloudinaryUrl(src, postcardImagesizes[postcardImagesizes.length - 1])
    );
    $el.attr(
      "sizes",
      `(max-width: 540px) 100vw, (max-width: 960px) 48vw, 30vw`
    );
    $el.attr("srcset", srcSet);
  });

  return $.html();
};

function makeUnsplashImage(src, width, extras = "") {
  return `${makeUnsplashUrl(src, width, extras)} ${width}w`;
}

function makeCloudinaryImage(src, width) {
  return `${makeCloudinaryUrl(src, width)} ${width}w`;
}

function makeUnsplashUrl(src, width, extras = "") {
  const url = new URL(src);
  const baseUrl = `${url.protocol}//${url.hostname}${url.pathname}`;
  return `${baseUrl}?w=${width}&auto=format&lossless=true${extras}`;
}

function makeCloudinaryUrl(src, width) {
  return src.replace(
    /cloudinary\.com\/boopathi\/image\/upload\/.+\/v1\/blog-images/g,
    `cloudinary.com/boopathi/image/upload/q_auto,f_auto,w_${width}/v1/blog-images`
  );
}

async function getSmallDataUri(src) {
  const resp = await fetch(src);
  const contentType = resp.headers.get("content-type");
  const buffer = await resp.buffer();
  const du = new Datauri();
  du.format("." + contentType.split("/")[1], buffer);

  return {
    src,
    datauri: du.content
  };
}
