"use strict";

const cheerio = require("cheerio");
const path = require("path");
const fs = require("fs");
const sizeOf = require("image-size");
const undici = require("undici");

const postContentImageSizes = [480, 720, 960, 1200, 1440];
const postContentImageSrcSizes = `(max-width: 720px) 100vw, 720px`;
const featureImageSizes = [480, 720, 960, 1200, 1440, 1600, 2000];
const featureImageSrcSizes = `(max-width: 720px) 100vw, 75vw`;
const postcardImageSizes = [480, 720, 960, 1200];
const postcardImageSrcSizes = `(max-width: 540px) 100vw, (max-width: 960px) 48vw, (max-width: 1024px) 30vw, 300px`;

const imageCacheFile = path.join(__dirname, "../../.images-cache.json");

class ImageCache {
  constructor() {
    this.ensureCacheFile();
    this.cache = JSON.parse(fs.readFileSync(imageCacheFile, "utf-8"));
  }

  ensureCacheFile() {
    if (!existsSync(imageCacheFile)) {
      fs.writeFileSync(imageCacheFile, "{}", "utf-8");
    }
  }

  writeCache() {
    fs.writeFileSync(imageCacheFile, JSON.stringify(this.cache));
  }

  async getImages(...urls) {
    const ret = await Promise.all(urls.map((url) => this.getImageByUrl(url)));
    this.writeCache();
    return ret;
  }

  async getImageByUrl(url) {
    if (hop(this.cache, url)) {
      return this.cache[url];
    }

    const response = await undici.request(url);
    if (response.statusCode != 200) {
      throw new Error(
        `Invalid Response code "${response.statusCode}" for url "${url}"`
      );
    }
    const chunks = [];
    for await (const data of response.body) {
      chunks.push(data);
    }
    this.cache[url] = sizeOf(Buffer.concat(chunks));
    return this.cache[url];
  }
}

const imageCache = new ImageCache();

async function transformImageElements($, $images, sizes, srcSizes) {
  const elements = [];
  $images.each((i, el) => elements.push($(el)));

  const dimensionsList = await imageCache.getImages(
    ...elements.map((el) => el.attr("src"))
  );

  for (const [idx, $el] of elements.entries()) {
    $el.attr("loading", "lazy");
    const src = $el.attr("src");
    const url = new URL(src);

    if (url.hostname.includes("unsplash")) {
      const srcSet = sizes.map((w) => makeUnsplashImage(src, w)).join(", ");
      const imageSrc = makeUnsplashUrl(src, sizes[sizes.length - 1]);
      const dimensions = dimensionsList[idx];
      $el.attr("width", dimensions.width);
      $el.attr("height", dimensions.height);
      $el.attr("src", imageSrc);
      $el.attr("sizes", srcSizes);
      $el.attr("srcset", srcSet);
    } else if (url.hostname.includes("cloudinary")) {
      const srcSet = sizes.map((w) => makeCloudinaryImage(src, w)).join(", ");
      const imageSrc = makeCloudinaryUrl(src, sizes[sizes.length - 1]);
      const dimensions = dimensionsList[idx];
      $el.attr("width", dimensions.width);
      $el.attr("height", dimensions.height);
      $el.attr("src", imageSrc);
      $el.attr("sizes", srcSizes);
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
  }
}

async function htmlLazyImages(html) {
  const $ = cheerio.load(html);
  const promises = [];

  // post content body images
  promises.push(
    transformImageElements(
      $,
      $(".post-content-body img"),
      postContentImageSizes,
      postContentImageSrcSizes
    )
  );

  // post feature image
  promises.push(
    transformImageElements(
      $,
      $(".post-content-image img"),
      postContentImageSizes,
      postContentImageSrcSizes
    )
  );

  // post card images
  promises.push(
    transformImageElements(
      $,
      $(".post-card-img"),
      postContentImageSizes,
      postContentImageSrcSizes
    )
  );

  await Promise.all(promises);

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

function existsSync(file) {
  try {
    fs.statSync(file);
    return true;
  } catch (e) {
    return false;
  }
}

function hop(o, key) {
  return Object.prototype.hasOwnProperty.call(o, key);
}

exports.processFeatureImage = processFeatureImage;
exports.processPostcardImage = processPostcardImage;
exports.htmlLazyImages = htmlLazyImages;
