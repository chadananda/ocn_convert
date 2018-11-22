const Converter = require('./oceanMarkdown')
const TurndownService = require('turndown')
const tables = require('turndown-plugin-gfm').tables
const cheerio = require('cheerio-advanced-selectors').wrap(require('cheerio'))
const { URL } = require('url')
const fp = require('../tools/filePath')
const Sema = require('async-sema')
const subLinks = []
const subLinksProcessed = []

class HtmlToMarkdown extends Converter {
  constructor(input, opts = {}) {
    super(input, opts)
    this.addDefaultConversionOpts({
      subLinkElement: 'a',
      subLinkTextPattern: '',
      subLinkUrlPattern: '/^[^#]+$/',
      subLinkAllowParents: false,
      subLinkDepth: 1,
      getSubLinks: false,
      convertTables: true,
      collapseTableCells: true,
      convertHeaderlessTables: true,
      multilineFootnotes: false,
      contentElement: 'body',
      downloadImages: false,
      metaElements: {
        title: 'title',
        author: '',
      },
    })
    if (this.opts.singleLevel) this.opts.subLinkDepth = 1
    try {
      this.url = new URL(opts.sourceUrl || opts._convertedFrom)
      opts.sourceUrl = this.url.toString()
    }
    catch(e) {
      this.url = ''
    }
    this.mergeAllOptions(opts)
    this.$ = cheerio.load(this.raw)

    this.toMd = new TurndownService({headingStyle: 'atx', emDelimiter: '*'})
      .remove(['script', 'iframe'])

    this.images = []

    // Convert tables if required
    if (this.opts.convertTables) {
      this.toMd.use(tables)
        .addRule('cells', {
          filter: ['th', 'td'],
          replacement: function(content, node) {
            var index = Array.prototype.indexOf.call(node.parentNode.childNodes, node)
            var prefix = ' '
            if (index === 0) prefix = '| '
            if (this.opts.collapseTableCells) content = content.replace(/[\r\n]/g, ' ')
            return prefix + content + ' |' + '|'.repeat((node.getAttribute('colspan') || 1) -1)
          }.bind(this)
        })
      if (this.opts.convertHeaderlessTables) {
        this.toMd.addRule('table', {
          filter: 'table',
          replacement: function (content, node) {
            if (!/[^ \n\|]+/.test(content)) return ''
            // Ensure a title row, for compatibility
            if (!/^[^\n]+\n[-: \|]+$/m.test(content)) {
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

    // Use absolute references for links and images
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
        let alt = node.alt || ''
        let href = node.getAttribute('src')
        let src = new URL(href, this.url)
        if (this.opts.downloadImages) {
          this.images.push(src)
          src = './img/' + fp.downloadFileName(src)
        }
        let title = node.title || ''
        let titlePart = title ? ' "' + title + '"' : ''
        return src ? `![${alt}](${src}${titlePart})` : ''
      }.bind(this)
    })

    this.subLinks = []
    this.subTexts = []

  }
}

HtmlToMarkdown.prototype.loadUrl = fp.loadUrl

HtmlToMarkdown.prototype.init = async function() {
  this.getSubLinks()
  const s = new Sema(1)
  for (let url of this.subLinks) {
    await s.acquire()
    url = new URL(url, this.url).toString()
    if (subLinksProcessed.indexOf(url) === -1) {
      if (this.debug) console.log(`loading ${url}`)
      let stream = await this.loadUrl(url)
      let doc = await this.getConverter(this.opts.converter || this.opts.c || 'html', stream, Object.assign({}, this.opts, {sourceUrl: url, footnotesPerPage: false, debug: this.debug, subLinkDepth: this.opts.subLinkDepth - 1 }))
      await doc.init()
      doc.prepareContent()
      subLinksProcessed.push(url)
      this.subTexts.push(doc.content)
      this.images = this.images.concat(doc.images)
      doc = null
    }
    s.release()
  }
  return this
}

HtmlToMarkdown.prototype.prepareMeta = function() {
  Object.keys(this.opts.metaElements).forEach(k => {
    if (!this.meta[k] && this.opts.metaElements[k]) this.meta[k] = this.$(this.opts.metaElements[k]).attr('content') || this.$(this.opts.metaElements[k]).text().trim() || ''
  })
  return this
}

HtmlToMarkdown.prototype.prepareContent = function() {
  this.prepareMeta()
  if (this.subTexts.length) {
    this.content = this.subTexts.join("\n\n* * *\n\n")
  }
  else {
    let html = this.$(this.opts.contentElement).toArray().map(e => this.$.html(this.$(e))).join('')
    if (html) {
      this.content = this.toMd.turndown( html )
    }
    else {
      this.content = ''
      console.warn(`No content in "${this.opts.contentElement}" at ${this.meta.sourceUrl}`)
    }
  }
  return this
}

HtmlToMarkdown.prototype.getSubLinks = function() {

  if (!this.opts.getSubLinks || !this.opts.subLinkDepth || !this.opts.subLinkElement) return this

  let links = this.$(this.opts.subLinkElement).get()
    .filter(function(a) {
      let href = a.attribs.href
      return (
        typeof href === 'string' &&
        (!this.opts.subLinkUrlPattern || this.toRegExp(this.opts.subLinkUrlPattern).test(href)) &&
        (!this.opts.subLinkTextPattern || this.toRegExp(this.opts.subLinkTextPattern).test(this.$(a).text()))
      )
    }.bind(this))

  if (typeof this.subLinkFilter === 'function') links = links.filter(this.subLinkFilter.bind(this))

  this.subLinks = links.map(v => v.attribs.href)
    .filter(function(v,i,a) {
      let vUrl = new URL(v, this.url)
      let vUrlDirectory = this.url.pathname.replace(/\/[^\/]*\.[^\/]*$/, '/')
      return (
        a.indexOf(v) === i && // Ensure unique links
        (this.opts.subLinkAllowParents || vUrl.pathname.indexOf(vUrlDirectory) === 0) // Ensure that sublinks are children of the current url
      )
    }.bind(this)) || []

  return this
}

HtmlToMarkdown.prototype.subLinkFilter = true

module.exports = HtmlToMarkdown
