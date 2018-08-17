const OceanMarkdown = require('./oceanMarkdown')
const TurndownService = require('turndown')
const cheerio = require('cheerio')

class HtmlToMarkdown extends OceanMarkdown {
  constructor(input, opts = {}, meta = {}, raw = '') {
    super(input, opts)
    this.toMd = new TurndownService({headingStyle: 'atx'}).remove('script')
    this.contentElements = ['body']
    this.metaElements = {
      title: 'title',
      author: '',
    }
  }
}

HtmlToMarkdown.prototype.convert = function() {
  const $ = cheerio.load(this.raw)
  Object.keys(this.metaElements).forEach(k => {
    if (this.metaElements[k]) this.meta[k] = $(this.metaElements[k]).text()
  })
  this.content = this.toMd.turndown( $(this.contentElements.join(',')).html() )
}

module.exports = HtmlToMarkdown