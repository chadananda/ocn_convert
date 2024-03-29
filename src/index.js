const Converters = {}
const sh = require('shelljs')
const path = require('path')
const converterRegex = /.+\/(\w+)ToMarkdown\.js/
for (let f of sh.find(path.join(__dirname, 'converters'))) {
  let match = f.match(converterRegex)
  if (match) {
    Converters[match[1]] = require(match[0])
  }
}

/**
 *
 * @param {string} contentType The content type which will be converted to markdown; also functions as the name of the converter.
 * Examples:
 * text: The TextToMarkdown converter, for converting plain text to Ocean Markdown
 * html: The HtmlToMarkdown converter, for converting html to Ocean Markdown
 * custom: A custom converter that extends OceanMarkdown and resides in src/converters/.../customToMarkdown.js
 * @param {stream|Buffer} data A stream or buffer of data, such as might be obtained from fs.createReadStream() or request().
 * @param {object} opts A set of options and metadata for the conversion object.
 */
async function getConverter(contentType, data, opts = {}) {
  let text
  // console.log(contentType)
  let fileOpts = Object.assign({}, opts, {encoding: null})
  if (opts.M) { // JUST WORK ON EXISTING FILE
    text = await Converters['text'].prototype.prepareStream(data, fileOpts)
    converter = new Converters['text'](text.content, opts)
    converter.prepareContent()
    return converter
  }
  else { // Work on original content
    text = await Converters[contentType].prototype.prepareStream(data, fileOpts)
    opts.encoding = text.encoding
    let converter = new Converters[contentType](text.content, opts)
    await converter.init()
    return converter
  }
}

module.exports = {
  converters: Converters,
  getConverter: getConverter,
}
