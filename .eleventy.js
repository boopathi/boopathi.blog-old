require("dotenv").config();

const cleanCSS = require("clean-css");
const fs = require("fs");
const pluginRSS = require("@11ty/eleventy-plugin-rss");
const ghostContentAPI = require("@tryghost/content-api");
const cheerio = require("cheerio");
const Terser = require("terser");

const htmlMinTransform = require("./src/transforms/html-min-transform");
const {
  htmlLazyImages,
  processFeatureImage,
  processPostcardImage,
} = require("./src/transforms/html-lazy-images");
const htmlPurgecssTransform = require("./src/transforms/html-purge-css");
const htmlPrismjs = require("./src/transforms/html-prismjs");

// Init Ghost API
const api = new ghostContentAPI({
  url: process.env.GHOST_API_URL,
  key: process.env.GHOST_CONTENT_API_KEY,
  version: "v2",
});

// Strip Ghost domain from urls
const stripDomain = (url) => {
  return url.replace(process.env.GHOST_API_URL, "");
};

module.exports = function (config) {
  // PrismJS
  config.addTransform("htmlprismjs", htmlPrismjs);

  // Minify HTML
  config.addTransform("htmlmin", htmlMinTransform);

  // purge css
  config.addTransform("htmlpurgecss", htmlPurgecssTransform);

  config.addTransform("htmlSrcSet", (value, outputPath) => {
    if (outputPath.includes(".html")) {
      const result = htmlLazyImages(value);
      return result;
    }
    return value;
  });

  // Assist RSS feed template
  config.addPlugin(pluginRSS);

  // Inline CSS
  config.addFilter("cssmin", (code) => {
    return new cleanCSS({}).minify(code).styles;
  });

  // Inline JS
  config.addFilter("jsmin", (code) => {
    const minified = Terser.minify(code);
    if (minified.error) {
      console.error("Terser Error: ", minified.error);
      return code;
    }
    return minified.code;
  });

  config.addFilter("getReadingTime", (text) => {
    const wordsPerMinute = 200;
    const numberOfWords = text.split(/\s/g).length;
    return Math.ceil(numberOfWords / wordsPerMinute);
  });

  config.addFilter("log", (obj) => console.log(obj));

  config.addFilter(
    "capitalize",
    (str) => str.charAt(0).toUpperCase() + str.slice(1)
  );

  // Date formatting filter
  config.addFilter("htmlDateString", (dateObj) => {
    const d = new Date(dateObj);
    const ye = new Intl.DateTimeFormat("en", { year: "numeric" }).format(d);
    const mo = new Intl.DateTimeFormat("en", { month: "short" }).format(d);
    const da = new Intl.DateTimeFormat("en", { day: "2-digit" }).format(d);
    return `${mo} ${da}, ${ye}`;
  });

  // Don't ignore the same files ignored in the git repo
  config.setUseGitIgnore(false);

  // Get all pages, called 'docs' to prevent
  // conflicting the eleventy page object
  config.addCollection("docs", async function (collection) {
    collection = await api.pages
      .browse({
        include: "authors",
        limit: "all",
      })
      .catch((err) => {
        console.error(err);
      });

    collection.map((doc) => {
      doc.url = stripDomain(doc.url);
      doc.primary_author.url = stripDomain(doc.primary_author.url);

      // Convert publish date into a Date object
      doc.published_at = new Date(doc.published_at);

      return doc;
    });

    return collection;
  });

  config.addCollection("logos", () => {
    const black =
      "https://res-2.cloudinary.com/boopathi/image/upload/q_auto/v1/blog-images/black_240-copy.png";
    const white =
      "https://res-2.cloudinary.com/boopathi/image/upload/q_auto/v1/blog-images/white_240-copy.png";
    return { black, white };
  });

  config.addCollection("intro", async () => {
    const collection = await api.pages.read({
      slug: "home-content",
    });

    return collection;
  });

  // Get all posts
  config.addCollection("posts", async function (collection) {
    collection = await api.posts
      .browse({
        include: "tags,authors",
        limit: "all",
      })
      .catch((err) => {
        console.error(err);
      });

    collection.forEach((post, i) => {
      post.url = stripDomain(post.url);
      post.primary_author.url = stripDomain(post.primary_author.url);
      post.tags.map((tag) => (tag.url = stripDomain(tag.url)));
      post.nextPosts = getNextPosts(post);

      // Convert publish date into a Date object
      post.published_at = new Date(post.published_at);
      // required for rss plugin
      post.date = post.published_at;
      post.shouldPreload = i < 3;

      if (post.feature_image) {
        const featureImage = processFeatureImage(post.feature_image);
        const postcardImage = processPostcardImage(post.feature_image);
        post.featureImageSrcSet = featureImage.srcSet;
        post.featureImageSizes = featureImage.sizes;
        post.postcardImageSrcSet = postcardImage.srcSet;
        post.postcardImageSizes = postcardImage.sizes;
      }
    });

    // Bring featured post to the top of the list
    // collection.sort((post, nextPost) => nextPost.featured - post.featured);

    return collection;
  });

  // Get all authors
  config.addCollection("authors", async function (collection) {
    collection = await api.authors
      .browse({
        limit: "all",
      })
      .catch((err) => {
        console.error(err);
      });

    // Get all posts with their authors attached
    const posts = await api.posts
      .browse({
        include: "authors",
        limit: "all",
      })
      .catch((err) => {
        console.error(err);
      });

    // Attach posts to their respective authors
    collection.forEach(async (author) => {
      const authorsPosts = posts.filter((post) => {
        post.url = stripDomain(post.url);
        return post.primary_author.id === author.id;
      });
      if (authorsPosts.length) author.posts = authorsPosts;

      author.url = stripDomain(author.url);
    });

    return collection;
  });

  // Get all tags
  config.addCollection("tags", async function (collection) {
    collection = await api.tags
      .browse({
        include: "count.posts",
        limit: "all",
      })
      .catch((err) => {
        console.error(err);
      });

    // Get all posts with their tags attached
    const posts = await api.posts
      .browse({
        include: "tags,authors",
        limit: "all",
      })
      .catch((err) => {
        console.error(err);
      });

    // Attach posts to their respective tags
    collection.forEach((tag) => {
      const taggedPosts = posts.filter((post) => {
        post.url = stripDomain(post.url);
        return post.tags.some((ptag) => ptag.slug === tag.slug);
      });
      if (taggedPosts.length) tag.posts = taggedPosts;

      tag.url = stripDomain(tag.url);
    });

    return collection;
  });

  // Display 404 page in BrowserSnyc
  config.setBrowserSyncConfig({
    callbacks: {
      ready: (err, bs) => {
        const content_404 = fs.readFileSync("dist/404.html");

        bs.addMiddleware("*", (req, res) => {
          // Provides the 404 content without redirect.
          res.write(content_404);
          res.end();
        });
      },
    },
  });

  // Eleventy configuration
  return {
    dir: {
      input: "src",
      output: "dist",
    },

    // Files read by Eleventy, add as needed
    templateFormats: ["css", "njk", "md", "txt"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    passthroughFileCopy: true,
  };
};

function getNextPosts(post) {
  const $ = cheerio.load(post.html);
  const nextPosts = [];

  $("a").each((i, el) => {
    const href = $(el).attr("href");
    if (
      href &&
      (href.startsWith("https://blog.boopathi.in") ||
        href.startsWith("https://boopathi.blog") ||
        href.startsWith("/"))
    ) {
      nextPosts.push(href);
    }
  });

  return nextPosts;
}
