"use strict";

const cheerio = require("cheerio");

const postContentImageSizes = [480, 720, 960, 1200, 1440];
const postContentImageSrcSizes = `(max-width: 720px) 100vw, 720px`;
const featureImageSizes = [480, 720, 960, 1200, 1440, 1600, 2000];
const featureImageSrcSizes = `(max-width: 720px) 100vw, 75vw`;
const postcardImageSizes = [480, 720, 960, 1200];
const postcardImageSrcSizes = `(max-width: 540px) 100vw, (max-width: 960px) 48vw, (max-width: 1024px) 30vw, 300px`;

exports.processFeatureImage = processFeatureImage;
exports.processPostcardImage = processPostcardImage;
exports.htmlLazyImages = htmlLazyImages;

function htmlLazyImages(html) {
  const $ = cheerio.load(html);

  const $bodyImages = $(".post-content-body img");

  $bodyImages.each((i, el) => {
    const $el = $(el);
    $el.attr("loading", "lazy");
    const src = $el.attr("src");
    const url = new URL(src);

    if (url.hostname.includes("unsplash")) {
      const srcSet = postContentImageSizes
        .map((w) => makeUnsplashImage(src, w))
        .join(", ");
      $el.attr(
        "src",
        makeUnsplashUrl(
          src,
          postContentImageSizes[postContentImageSizes.length - 1]
        )
      );
      $el.attr("sizes", postContentImageSrcSizes);
      $el.attr("srcset", srcSet);
    } else if (url.hostname.includes("cloudinary")) {
      const originalSrc = $el.attr("src");
      const srcSet = postContentImageSizes
        .map((w) => makeCloudinaryImage(originalSrc, w))
        .join(", ");
      $el.attr(
        "src",
        makeCloudinaryUrl(
          src,
          postContentImageSizes[postContentImageSizes.length - 1]
        )
      );
      $el.attr("sizes", postContentImageSrcSizes);
      $el.attr("srcset", srcSet);
    } else if (
      (url.hostname.includes("blog.boopathi.in") ||
        url.hostname.includes("boopathi.blog")) &&
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

    const src = $el.attr("src");
    const srcSet = featureImageSizes
      .map((w) => makeCloudinaryImage(src, w))
      .join(", ");

    $el.attr(
      "src",
      makeCloudinaryUrl(src, featureImageSizes[featureImageSizes.length - 1])
    );
    $el.attr("sizes", featureImageSrcSizes);
    $el.attr("srcset", srcSet);
  });

  const $postcardImages = $(".post-card-img");
  $postcardImages.each((i, el) => {
    const $el = $(el);
    $el.attr("loading", "lazy");

    const src = $el.attr("src");
    const srcSet = postcardImageSizes
      .map((w) => makeCloudinaryImage(src, w))
      .join(", ");

    $el.attr(
      "src",
      makeCloudinaryUrl(src, postcardImageSizes[postcardImageSizes.length - 1])
    );
    $el.attr("sizes", postcardImageSrcSizes);
    $el.attr("srcset", srcSet);
  });

  return $.html();
}

function processFeatureImage(url) {
  const srcSet = featureImageSizes
    .map((width) => makeCloudinaryImage(url, width))
    .join(", ");

  return { srcSet, sizes: featureImageSrcSizes };
}

function processPostcardImage(url) {
  const srcSet = postcardImageSizes
    .map((width) => makeCloudinaryImage(url, width))
    .join(", ");

  return { srcSet, sizes: postcardImageSrcSizes };
}

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
