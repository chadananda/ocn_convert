const Converter = require('./oceanMarkdown')
const TurndownService = require('turndown')
const tables = require('turndown-plugin-gfm').tables
const cheerio = require('cheerio')
const { URL } = require('url')
const fp = require('../tools/filePath')
const Sema = require('async-sema')

class HtmlToMarkdown extends Converter {
  constructor(input, opts = {}, meta = {}, raw = '') {
    super(input, opts)
    this.addDefaultConversionOpts({
      convertTables: true,
      convertHeaderlessTables: true,
      contentElement: 'body',
      metaElements: {
        title: 'title',
        author: '',
      },
    })
    try {
      this.url = new URL(opts.sourceUrl || opts._convertedFrom)
      opts.sourceUrl = this.url.toString()
    }
    catch(e) {
      this.url = ''
    }
    this.mergeAllOptions(opts)
    this.$ = cheerio.load(this.raw)

    Object.keys(this.opts.metaElements).forEach(k => {
      if (this.opts.metaElements[k]) this.meta[k] = this.$(this.opts.metaElements[k]).text()
    })
  

    this.toMd = new TurndownService({headingStyle: 'atx', emDelimiter: '*'})
      .remove('script')
      if (this.opts.convertTables) {
        this.toMd.use(tables)
        if (this.opts.convertHeaderlessTables) {
          this.toMd.addRule('table', {
            filter: 'table',
            replacement: function (content, node) {
              // Ensure a title row, for compatibility
              if (!/^[^\n]\n[- \|]/m.test(content)) {
                let n = node.rows[0].childNodes.length
                content = `${'|   '.repeat(n) + '|'}\n${'| - '.repeat(n) + '|'}${content}`
              }
              // Ensure there are no blank lines
              content = content.replace('\n\n', '\n')
              return '\n\n' + content + '\n\n'
            }          
          })
        }
      }
      this.toMd.addRule('absoluteLinks', {
        filter: function (node, options) {
          return (
            node.nodeName === 'A' &&
            node.getAttribute('href')
          )
        },
        replacement: function(content, node, options) {
          let href = node.getAttribute('href')
          if (!/^#/.test(href)) {
            href = new URL(node.getAttribute('href'), this.url).toString()
          }
          let title = node.title ? ' "' + node.title + '"' : ''
          return '[' + content + '](' + href + title + ')'
        }.bind(this)
      })
      .addRule('absoluteImages', {
        filter: 'img',
        replacement: function (content, node) {
          var alt = node.alt || ''
          var src = new URL(node.getAttribute('src'), this.url)
          var title = node.title || ''
          var titlePart = title ? ' "' + title + '"' : ''
          return src ? '![' + alt + ']' + '(' + src + titlePart + ')' : ''
        }.bind(this)
      })

    this.subLinks = []
    this.subTexts = []
    
    this.prepareContent()

  }
}

HtmlToMarkdown.prototype.loadUrl = fp.loadUrl

HtmlToMarkdown.prototype.init = async function() {
  const s = new Sema(1)
  for (let url of this.subLinks) {
    await s.acquire()
    url = new URL(url, this.url).toString()
    let stream = await this.loadUrl(url)
    let doc = await this.getConverter(this.opts.converter || this.opts.c || 'html', stream, Object.assign({}, this.opts, {sourceUrl: url}))
    await doc.init()
    doc.convert()
    this.subTexts.push(doc)
    s.release()
  }
  return this
}

HtmlToMarkdown.prototype.prepareContent = function() {
  if (this.subTexts.length) {
    this.content = this.subTexts.map(doc => doc.content).join("\n\n* * *\n\n")
  }
  else {
    this.content = this.toMd.turndown( this.$(this.opts.contentElements.join(', ')).html() )
  }
  return this
}

module.exports = HtmlToMarkdown