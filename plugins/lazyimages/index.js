const fs = require("fs");
const { JSDOM } = require("jsdom");
const Jimp = require("jimp");
const Terser = require("terser");

const transformImgPath = (src) => {
  if (src.startsWith("/") && !src.startsWith("//")) {
    return `.${src}`;
  }

  return src;
};

const defaultLazyImagesConfig = {
  maxPlaceholderWidth: 12,
  maxPlaceholderHeight: 12,
  placeholderQuality: 60,
  imgSelector: "img",
  transformImgPath,
  className: "lazyload",
  cacheFile: ".lazyimages.json",
  appendInitScript: false,
  scriptSrc: "https://cdn.jsdelivr.net/npm/lazysizes@5.2.0/lazysizes.min.js",
};

let lazyImagesConfig = defaultLazyImagesConfig;
let lazyImagesCache = {};

const logMessage = (message) => {
  console.log(`LazyImages - ${message}`);
};

const loadCache = () => {
  const { cacheFile } = lazyImagesConfig;

  if (!cacheFile) {
    return;
  }

  try {
    if (fs.existsSync(cacheFile)) {
      const cachedData = fs.readFileSync(cacheFile, "utf8");
      lazyImagesCache = JSON.parse(cachedData);
    }
  } catch (e) {
    console.error("LazyImages: cacheFile", e);
  }
};

const readCache = (imageSrc) => {
  if (imageSrc in lazyImagesCache) {
    return lazyImagesCache[imageSrc];
  }

  return undefined;
};

const updateCache = (imageSrc, imageData) => {
  const { cacheFile } = lazyImagesConfig;
  lazyImagesCache[imageSrc] = imageData;

  if (cacheFile) {
    const cacheData = JSON.stringify(lazyImagesCache);

    fs.writeFile(cacheFile, cacheData, (err) => {
      if (err) {
        console.error("LazyImages: cacheFile", e);
      }
    });
  }
};

const getImageData = async (imageSrc) => {
  const {
    maxPlaceholderWidth,
    maxPlaceholderHeight,
    placeholderQuality,
  } = lazyImagesConfig;

  let imageData = readCache(imageSrc);

  if (imageData) {
    return imageData;
  }

  logMessage(`started processing ${imageSrc}`);

  const image = await Jimp.read(imageSrc);
  const width = image.bitmap.width;
  const height = image.bitmap.height;

  const resized = image
    .scaleToFit(maxPlaceholderWidth, maxPlaceholderHeight)
    .quality(placeholderQuality);

  const encoded = await resized.getBase64Async(Jimp.MIME_JPEG);

  imageData = {
    width,
    height,
    src: encoded,
  };

  logMessage(`finished processing ${imageSrc}`);
  updateCache(imageSrc, imageData);
  return imageData;
};

const processImage = async (imgElem, shouldLazyLoadImage) => {
  const { transformImgPath, className } = lazyImagesConfig;
  const imgPath = transformImgPath(imgElem.src);

  if (shouldLazyLoadImage) {
    imgElem.classList.add(className);
    if (imgElem.hasAttribute("srcset")) {
      const srcSet = imgElem.getAttribute("srcset");
      imgElem.setAttribute("data-srcset", srcSet);
    } else {
      const src = imgElem.getAttribute("src");
      imgElem.setAttribute("data-src", src);
    }
  }

  try {
    const image = await getImageData(imgPath);

    imgElem.setAttribute("width", image.width);
    imgElem.setAttribute("height", image.height);
    if (shouldLazyLoadImage) {
      imgElem.setAttribute("srcset", image.src);
    }
  } catch (e) {
    console.error("LazyImages", imgPath, e);
  }
};

// Have to use lowest common denominator JS language features here
// because we don't know what the target browser support is
const initLazyImages = function (selector, src) {
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.body.appendChild(script);
};

const transformMarkup = async (rawContent, outputPath) => {
  const { imgSelector, appendInitScript, scriptSrc } = lazyImagesConfig;
  let content = rawContent;

  if (outputPath.endsWith(".html")) {
    const dom = new JSDOM(content);

    const featureImage = dom.window.document.querySelector(
      ".post-content-image img"
    );
    if (featureImage) {
      dom.window.document.head.insertAdjacentHTML(
        "beforeend",
        `
          <link
            rel="preload"
            href="${featureImage.src}"
            as="image"
            imagesrcset="${featureImage.srcset}"
            imagesizes="${featureImage.sizes}" />
        `
      );
      logMessage(`processing featured image in ${outputPath}`);
      await processImage(featureImage, true);
      logMessage(`processed featured image in ${outputPath}`);
    }

    const images = [...dom.window.document.querySelectorAll(imgSelector)];

    if (images.length > 0) {
      logMessage(`found ${images.length} images in ${outputPath}`);
      await Promise.all(images.map((img) => processImage(img, true)));
      logMessage(`processed ${images.length} images in ${outputPath}`);

      if (appendInitScript) {
        let code = `
          (${initLazyImages.toString()})(
            '${imgSelector}',
            '${scriptSrc}'
          );
        `;
        const minified = Terser.minify(code);
        if (minified.error) {
          console.error(`Tersor Minification error: `, minified.error);
        } else {
          code = minified.code;
        }

        dom.window.document.body.insertAdjacentHTML(
          "beforeend",
          `<script>${code}</script>`
        );
      }
    }
    content = dom.serialize();
  }

  return content;
};

module.exports = {
  initArguments: {},
  configFunction: (eleventyConfig, pluginOptions = {}) => {
    lazyImagesConfig = Object.assign(
      {},
      defaultLazyImagesConfig,
      pluginOptions
    );

    loadCache();
    eleventyConfig.addTransform("lazyimages", transformMarkup);
  },
};
