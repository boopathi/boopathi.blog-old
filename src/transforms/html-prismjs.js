const prismjs = require("prismjs");
const loadLanguages = require("prismjs/components/index");
const fs = require("fs");
const path = require("path");

const cheerio = require("cheerio");

loadLanguages(["graphql", "typescript", "json", "javascript", "http", "bash"]);

const prismcss = fs.readFileSync(
  path.join(__dirname, "../_includes/css/prism-dracula.css"),
  "utf8"
);

module.exports = function htmlLazyImages(value, outputPath) {
  if (outputPath.indexOf(".html") > -1) {
    const $ = cheerio.load(value);

    $("head").append(`
      <style>
        ${prismcss}
      </style>
    `);

    $("code[class ^= language-]").each((i, el) => {
      const $el = $(el);

      const classname = $el.attr("class");
      let lang = classname.slice("language-".length).toLowerCase();

      if (lang === "js") lang = "javascript";
      if (lang === "ts") lang = "typescript";

      if (prismjs.languages[lang]) {
        const newHtml = prismjs.highlight(
          $el.text(),
          Prism.languages[lang],
          lang
        );

        $el.attr("class", `language-${lang}`);
        $el.parent().attr("class", `language-${lang}`);
        $el.html(newHtml);
      } else {
        console.error(
          `Cannot find language ${lang}, ${Object.keys(prismjs.languages)}`
        );
      }
    });

    return $.html();
  }

  return value;
};
