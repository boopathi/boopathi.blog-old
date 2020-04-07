const { PurgeCSS } = require("purgecss");
const fromHtml = require("purgecss-from-html");
const cheerio = require("cheerio");

module.exports = async function htmlPurgecss(value, outputPath) {
  if (outputPath.indexOf(".html") > -1) {
    const purger = new PurgeCSS();

    const $ = cheerio.load(value);

    const css = extractStyleContents($);

    const results = await purger.purge({
      content: [
        {
          raw: value,
          extension: "html"
        }
      ],
      css: css.map(raw => ({
        raw,
        extension: "css"
      })),
      whitelist: ["site-head-open"],
      extractors: [
        {
          extractor: fromHtml,
          extensions: ["html"]
        }
      ]
    });

    replaceStyleContents($, results);

    return $.html();
  }
  return value;
};

function extractStyleContents($) {
  const css = [];
  $("style").each((i, el) => {
    css.push($(el).html());
  });
  return css;
}

function replaceStyleContents($, results) {
  $("style").each((i, el) => {
    $(el).text(results[i].css);
  });
}
