const Spider = require('./node-spider')
const Document = require('./node-spider-document')
const matter = require('gray-matter')
const writeFileSync = require('fs').writeFileSync
const fp = require('../tools/filePath')
const { URL } = require('url')
const path = require('path')
const request = require('request')
const cachedRequest = require('cached-request')(request)
cachedRequest.setCacheDirectory(__dirname + '/../../cache')
cachedRequest.setValue('ttl', (60*60*24*30*1000))
const sh = require('shelljs')
const tr = require('transliteration').slugify

class OceanSpider extends Spider {
  constructor(url, opts = {}) {
    super(Object.assign({}, opts))
    Object.assign(this.opts, {
      // OPTIONS FOR LINKS TO FOLLOW
      selector: 'a', // Any cheerio selector for the links to follow
      linkText: '', // RegExp text for links to follow
      followExtFilter: opts.extFilter || 'htm,html,xhtml,asp,php,none',
      followUrlFilter: opts.urlFilter || false,
      followAllowQuery: opts.allowQuery || true, // Whether to follow links with a querystring
      followAllowHash: opts.allowHash || false, // Whether to follow links with a hash
      followAllowParents: opts.allowParents || false, // Whether to follow links to files on paths above the base URL
      followAllowExternal: opts.allowExternal || false, // Whether to follow external links - If you set this without also setting spiderUrlFilter or spiderMaxLinkDepth, you can spider the entire internet!
      followMinPathDepth: opts.minPathDepth || 0, // Minimum nesting depth of files to spider: e.g. nestingMinDepth: 1 will not retrieve files in the same folder as the original URL
      followMaxPathDepth: opts.maxPathDepth || 100, // Maximum nesting depth of files to spider: e.g. nestingMaxDepth: 0 will only retrieve files in the same folder as the original URL
      // OPTIONS FOR LINKS TO SPIDER
      spiderExtFilter: opts.extFilter || 'htm,html,xhtml,asp,php,none', // Example: 'htm, html, asp, php'
      spiderUrlFilter: opts.urlFilter || false, // String or RegExp
      spiderAllowQuery: opts.allowQuery || true, // Whether to spider files with a querystring
      spiderAllowHash: opts.allowHash || false, // Whether to spider files with a hash
      spiderAllowParents: opts.allowParents || false, // Whether to spider files on paths above the base URL
      spiderAllowExternal: opts.allowExternal || false, // Whether to spider external links - If you set this without also setting spiderUrlFilter or spiderMaxLinkDepth, you can spider the entire internet!
      spiderMinPathDepth: opts.minPathDepth || 0, // Minimum nesting depth of files to spider: e.g. nestingMinDepth: 1 will not retrieve files in the same folder as the original URL
      spiderMaxPathDepth: opts.maxPathDepth || 100, // Maximum nesting depth of files to spider: e.g. nestingMaxDepth: 0 will only retrieve files in the same folder as the original URL
      // OPTIONS FOR LINKS TO SAVE AS DOCUMENTS
      docExtFilter: opts.extFilter || 'htm,html,xhtml,asp,php,txt,md,none',
      docUrlFilter: opts.urlFilter || '',
      docAllowQuery: opts.allowQuery || true,
      docAllowHash: opts.allowHash || false,
      docAllowParents: opts.allowParents || false,
      docAllowExternal: opts.allowExternal || false,
      docMinPathDepth: opts.minPathDepth || 0,
      docMaxPathDepth: opts.maxPathDepth || 100,
      // LINK DEPTH OPTIONS
      minLinkDepth: 1, // The minimum link depth at which to begin saving documents
      maxLinkDepth: 0, // The maximum link depth to spider (0 = infinite)
      // FILENAME OPTIONS
      fileNameElement: 'title',
      fileNamePattern: '',
      // BASE SPIDER OPTIONS
      concurrent: 1, // How many requests can be run in parallel
      delay: 100, // How long to wait after each request
      logs: process.stderr, // A stream to where internal logs are sent, optional
      allowDuplicates: false, // Re-visit visited URLs, false by default
      catchErrors: true, // If `true` all queued handlers will be try-catch'd, errors go to `error` callback
      addReferrer: false, // If `true` the spider will set the Referer header automatically on subsequent requests
      xhr: false, // If `true` adds the X-Requested-With:XMLHttpRequest header
      keepAlive: false, // If `true` adds the Connection:keep-alive header and forever option on request module
      //- All options are passed to `request` module, for example:
      headers: { 'user-agent': 'node-spider' },
      encoding: 'utf8'
    }, opts)
    this.opts.error = function(err, url) {
      if (this.opts.debug) throw err
      this.log(`Error (${err})`, url)
    }.bind(this)
    this.baseURL = new URL(url)
    this.linkDepth = {[url]: 0}
    this.queue(url, this._process)
  }

  _process(doc) {
    let href = doc.url.toString()
    let url = new URL(href)
    let linkDepth = (typeof this.linkDepth[href] === 'number' ? this.linkDepth[href] : 1000)
    let fileName = this.writeFileName(doc)

    // SPIDER ===================================
    if (
      (!this.opts.maxLinkDepth || linkDepth < this.opts.maxLinkDepth) && // stop spidering one level beneath maxLinkDepth
      (linkDepth === 0 || this._filterUrl(url, 'spider')) // check the spider filters for all URLs except the baseURL
    ) {
      let links = doc.$(this.opts.selector || 'a')
      if (this.opts.linkText) {
        let linkText = new RegExp(this.opts.linkText)
        links = links.filter((i,e) => {
          return linkText.test(doc.$(e).text())
        })
      }
      links = links.get().map(v => new URL(v.attribs.href, doc.url)).filter(this._filterUrl, this)
      for (let url of links) {
        let href = url.href
        this.linkDepth[href] = Math.min(linkDepth + 1, (this.linkDepth[href] || 1001))
        this.queue(href, this._process)
      }
    }

    // SAVE DOCUMENT ============================
    let tests = {
      statusCode: doc.res.statusCode === 200, // Check that the status was not an error
      existingFile: !sh.test('-e', fileName), // Ensure that the filename does not already exist
      urlFilter: this._filterUrl(url, 'doc'), // Ensure that the document's url is one that should be scraped
      linkDepth: linkDepth >= this.opts.minLinkDepth, // Ensure that the link depth is at least the minimum
      docFilter: this.docFilter(doc) // Pass through the final filter
    }
    if (tests.statusCode && tests.existingFile && tests.urlFilter && tests.linkDepth && tests.docFilter) {
      if (!sh.test('-d', path.dirname(fileName))) sh.mkdir('-p', path.dirname(fileName))
      let meta = { sourceUrl: href, _convertedFrom: href, _converstionOpts: {reconvert: true} }
      if (this.opts.converter) meta._conversionOpts = {converter: this.opts.converter}
      writeFileSync(fileName, matter.stringify('', meta))
    }
    else console.log(`Skipping ${fileName}:`, Object.keys(tests).filter(t => !tests[t]).join(', '))
  }

  _request(opts, done) {
    cachedRequest(opts, done)
  }

  /**
   *
   * @param {URL} url
   * @param {string} mode
   */
  _filterUrl(url, mode = 'follow') {
    mode = (['doc', 'spider'].indexOf(mode) >= 0 ? mode : 'follow')
    let pathName = url.pathname.replace(/\/$/, '/index.none')
    let urlDirname = path.dirname(pathName)
    let urlExtname = path.extname(pathName).replace('.', '') || 'none'
    let baseDirname = path.dirname(this.baseURL.pathname.replace(/\/$/, '/index.none'))
    let pathDepth = (urlDirname.replace(baseDirname, '').split('/') || []).length
    if (!this.opts[mode + 'AllowQuery'] && url.href.indexOf('?') !== -1) return false
    if (!this.opts[mode + 'AllowHash'] && url.href.indexOf('#') !== -1) return false
    if (!this.opts[mode + 'AllowExternal'] && url.hostname !== this.baseURL.hostname) return false
    if (!this.opts[mode + 'AllowParents'] && urlDirname.indexOf(baseDirname) !== 0) return false
    if (this[mode + 'ExtFilter'].length && this[mode + 'ExtFilter'].indexOf(urlExtname) === -1) return false
    if (this[mode + 'UrlFilter'] && url.href.split(this[mode + 'UrlFilter']).length < 2) return false
    if (!(this.opts[mode + 'MinPathDepth'] <= pathDepth <= this.opts[mode + 'MaxPathDepth'])) return false
    return true
  }

  get followUrlFilter() {
    return this.opts.followUrlFilter
  }

  get followExtFilter() {
    return this._followExtFilter || (this._followExtFilter = this._getExtFilter('follow'))
  }

  get spiderUrlFilter() {
    return this.opts.spiderUrlFilter
  }

  get spiderExtFilter() {
    return this._spiderExtFilter || (this._spiderExtFilter = this._getExtFilter('spider'))
  }

  get docUrlFilter() {
    return this.opts.docUrlFilter
  }

  get docExtFilter() {
    return this._docExtFilter || (this._docExtFilter = this._getExtFilter('doc'))
  }

  get path() {
    return this._path || (this._path = this._getPath())
  }

  _getExtFilter(mode) {
    if (mode === 'follow') {
      let extFilter = (this.opts.followExtFilter || '').replace(/\./g, '').split(/, ?/g).filter(v => (v?true:false))
      if (extFilter.length) return [...extFilter, ...this._getExtFilter('spider'), ...this._getExtFilter('doc')]
      return []
    }
    return (this.opts[mode + 'ExtFilter'] || '').replace(/\./g, '').split(/, ?/g).filter(v => (v?true:false))
  }

  _getPath() {
    return this.opts.p || this.opts.o || fp.resolve('.')
  }

  /**
   *
   * @param {Document} doc
   */
  docFilter(doc) {
    return true
  }

  writeFileName(doc) {
    let name = ''
    if (this.opts.fileNameElement) name = doc.$(this.opts.fileNameElement).text().replace(/[:\?\\\*"<>\|!]/g, '') || ''
    if (this.opts.fileNamePattern) name = (name.match(new RegExp(this.opts.fileNamePattern)) || []).slice(1).join() || name
    name = (name ? name + '.md' : fp.urlToFilename(doc.url))
    return `${this.path}/${name}`
  }

  slugify(text) {
    return tr(text)
  }

}

module.exports = OceanSpider

