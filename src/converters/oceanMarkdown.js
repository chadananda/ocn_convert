/**
 * @fileOverview
 * Provides a class for creating ocean markdown.
 * 
 * Meta information reqirements are available in README.md
 */
const BahaiAutocorrect = require('bahai-autocorrect')
const matter = require('gray-matter')
const wordlist = [...require('an-array-of-english-words'), ...require('an-array-of-french-words')]
const path = require('path')
const sh = require('shelljs')
const iconv = require('iconv-lite')
const chardet = require('chardet')
const fs = require('fs')
const tr = require('transliteration').slugify
const isUrl = require('is-url')

class OceanMarkdown{

  /**
   * Class for creating Ocean Markdown files.
   * @param {string} input Existing ocean markdown, raw data, or filepath
   * @param {object} opts The options to use when converting to markdown
   * @param {object} meta Metadata for the markdown file
   * @param {string} raw Raw data, if overriding the existing content
   */
  constructor(input, opts = {}, meta = {}, raw = '') {
    let encoding = opts.E || false
    let file

    // GET INITIAL DATA
    if ((file = this._loadFile(input, encoding)) !== false) {
      // This may be a previously converted Ocean Markdown file, or it may be an original file, either on disk or in a URL.
      // It gets loaded first because we need to process the YFM metadata to determine the conversion options.
      // We may also need to load the original file later in order to get the raw data.
      this.filePath = path.resolve(process.cwd(), input)
      encoding = file.encoding
      input = file.content
    }

    // Correct improper YFM
    if (opts.fixMeta) {
      let testMatter = input.match(/^([\s\S]*?)(?:\.{2,6}|---)\s*(\n[\s\S]+?\n)(?:\.{2,6}|---)\s*\n/m)
      if (testMatter[1] === "" && !/\n\n/.test(testMatter[2])) {
        let newMatter = ('---' + testMatter[2] + '---\n')
          // fix lines with apostrophes
          .replace(/^( *)([\w_]+|'[^']'): .*'.*/mg, t => (/^[^:]+: '.*'$/.test(t) ? t : t.replace(/^( *)([\w_]+|'[^']'): /, '$1$2: >-\n$1  ')) )
          // fix lines with quotes
          .replace(/^( *)([\w_]+|'[^']'): .*".*/mg, t => (/^[^:]+: ".*"$/.test(t) ? t : t.replace(/^( *)([\w_]+|'[^']'): /, '$1$2: >-\n$1  ')) )
          // fix lines with brackets
          .replace(/^( *)([\w_]+|'[^']'): (.*?\[)/mg, '$1$2: >-\n$1  $3')
          // fix lines with colons
          .replace(/^( *)([\w_]+|'[^']'): (.*?: )/mg, '$1$2: >-\n$1  $3')
          // fix lines with no value
          .replace(/^( *(?:[\w_]+|'[^']')): *\r?\n(?! {2,}(?:[\w_]+:|'))/mg, '$1: \'\'\n')
          // fix lines with values that are followed by un-indented multi-line values
          .replace(/^([\w_]+|'[^']'): (.{3,}\r?\n)(?![\w_]+: |'[^']': |---)/gm, '$1: |\n  $2')
          .replace(/^((?![\w_]+:[ \r\n]| '[^']':[ \r\n]|---)[^\s\r\n']+)/gm, '  $1')
        // replace broken YFM with fixed
        input = input.replace(testMatter[0], newMatter)
      }
    }

    // CONTENT
    let fromInput = matter(input)
    this.content = fromInput.content || ''

    // ENCODING
    if (encoding !== 'UTF-8') {
      opts.encoding = encoding
    }

    // METADATA
    this.meta = Object.assign({
      id: '', // TODO: set ID
      title: '',
      author: '',
      access: 'encumbered',
      language: 'en',
      priority: 10,
      wordsCount: 0,
      _conversionOpts: {},
    }, fromInput.data || {}, meta)

    // CONVERSION OPTIONS
    this.optionTypes = {}
    this.defaultConversionOpts = {}
    this.addDefaultConversionOpts({
      encoding: 'UTF-8',
      reconvert: true,
      correctBahaiWords: true,
      correctSoftHyphens: true,
      prePatterns: {
        "/ah([aá])(['`’‘])I/": 'ah$1$2í'
      },
      postPatterns: {
        '/<[uU]>([CDGKSTZcdgkstz])([hH])<\/[uU]>/': '$1_$2', // can't strip the <u> tags until the end, because it messes up italics determination
        '/\\n[\\n\\s]+/': '\n\n',
      }
    })
    // Set new conversion options for saving
    this.meta._conversionOpts = this.mergeOptions(this.meta._conversionOpts, opts, {reconvert: true})
    // Get the full list of options for conversion
    this.opts = this.mergeOptions(this.defaultConversionOpts, this.meta._conversionOpts)

    // BASIC TEXT CLEANUP PATTERNS
    this.cleanupPatterns = {
      // Line breaks
      '/\r\n/': '\n',
      '/\r/': '\n',
      // Trailing spaces
      '/[ \t]+$/': '',
      // Soft hyphens
      '/(\\d+)\xAD(\\d+)/': '$1-$2',
      '/[-\xAD]{2,}/': '--',
      '/ \xAD /': ' - ',
    }

    // DEBUGGING
    this.debug = opts.debug
    this.debugInfo = {}

    // RAW DATA
    // Since we may be re-converting an Ocean Markdown file, we may
    // need to get the original data from metadata or passed arguments.
    // The original data goes into this.raw.
    encoding = opts.E || this.meta._conversionOpts.encoding || false
    if (raw) {
      // If a filename has been passed, get it
      if ((file = this._loadFile(raw, encoding)) !== false) {
        this.raw = file.content
        if (file.encoding !== 'UTF-8') this.meta._conversionOpts.encoding = rawFile.encoding
      }
      // Use any other string as raw data
      else {
        this.raw = raw
      }
    }
    else if (this.meta._convertedFrom) {
      // If there is a file source in the metadata, get that
      if ((file = this._loadFile(this.meta._convertedFrom, encoding)) !== false) {
        this.raw = file.content
        if (file.encoding !== 'UTF-8') this.meta._conversionOpts.encoding = file.encoding
      }
      // If you can't get it, then leave the raw unset -- there is raw data, but it is unavailable
      else {
        this.raw = ''
      }
    }
    else {
      // If there is no data passed, and no file source in the meta, then the content is also the raw data
      this.raw = this.content
    }

    // VERBOSE LOGGING
    if (opts.v) {
      console.log (Object.assign({}, this, {raw: this.raw.length + ' chars',content: this.content.length + ' chars'}))
    }
  }
}

/**
 * Set default conversion opts, and track option types.
 * @param {object} opts The options to add to the defaults
 */
OceanMarkdown.prototype.addDefaultConversionOpts = function(opts) {
  Object.keys(opts).forEach(k => {
    // Record option type if necessary
    if (typeof this.optionTypes[k] === 'undefined') {
      this.optionTypes[k] = (Array.isArray(opts[k]) ? 'array' : typeof opts[k])
    }
  })
  this.defaultConversionOpts = this.mergeOptions(this.defaultConversionOpts, opts)
  return this
}

/**
 * Merges two sets of options. Any option that is not recognized will
 * be ignored, so command line options may be merged without sanitization.
 * @param {object} existing The existing options
 * @param {object} merging The options to be merged in
 */
OceanMarkdown.prototype.mergeOptions = function(existing, merging) {
  Object.keys(merging).forEach(k => {
    if (typeof this.optionTypes[k] !== 'string') {
      return
    }
    let type = this.optionTypes[k]
    if (typeof existing[k] === 'undefined') {
      existing[k] = merging[k]
    }
    else if (merging[k] === false) {
      if (type === 'string') {
        existing[k] = ''
      }
      else if (type === 'array') {
        existing[k] = []
      }
      else if (type === 'number') {
        existing[k] = 0
      }
      else if (type === 'object') {
        existing[k] = {}
      }
      else {
        existing[k] = false
      }
    }
    else if (type === 'array' && typeof merging[k] === 'string') {
      existing[k].push(merging[k])
    }
    else if (typeof merging[k] !== type || (Array.isArray(existing[k]) && !Array.isArray(merging[k]))) {
      throw new Error(`Wrong option type ${typeof merging[k]} for ${k} (expected ${type})`)
    }
    else {
      switch (type) {
        case 'boolean':
        case 'string':
        case 'number':
          existing[k] = merging[k]
          break;
        case 'array':
          existing[k] = [...existing[k], ...merging[k]]
          break;
        case 'object':
          Object.assign(existing[k], merging[k])
          break;
      }
    }
  })
  return existing
}

OceanMarkdown.prototype.convert = function() {

  if (!this.raw) {
    console.error(`Error: "${this.meta._convertedFrom}" does not exist on your system, and you have requested to reconvert it. You can either:
    1. change the "_convertedFrom" metadata in "${this.filePath}", or
    2. go to the folder where the document is and convert it again with this option:
    -p "${path.dirname(this.filePath)}"`)
  }

  // Reset content
  this.content = this.raw

  this.cleanupText().replaceAll(this.opts.prePatterns)

  if (this.opts.correctSoftHyphens) {
    // Soft hyphen words are calculated every time
    this.meta._softHyphenWords = ''
    this.correctSoftHyphens()
  }

  if (this.opts.correctBahaiWords) {
    this.correctBahaiWords()
  }

  this.replaceAll(this.opts.postPatterns)

  return this
}

OceanMarkdown.prototype.cleanupText = function() {
  this.replaceAll(this.cleanupPatterns)
  return this
}

OceanMarkdown.prototype.correctBahaiWords = function() {
  let bahaiAutocorrect = new BahaiAutocorrect(this.content, false, this.debug)
  this.content = bahaiAutocorrect.correct().toString()
  if (this.debug) {
    this.debugInfo.bahai = [...new Set(bahaiAutocorrect.diff.split('\n'))]
  }
  return this
}

OceanMarkdown.prototype.correctSoftHyphens = function() {
  let softHyphenWords = []
  if (this.content.match('\xAD')) {
    // This regex finds all soft-hyphenated words and adds them to the index for each file.
    this.content.replace(/["“\'\(\[_`‘]*(\S+\xAD\S+?)["“\)\]\*\+\'`‘!?.,;:_\d]*(?!\S)/gm, (m, p1) => { softHyphenWords.push(p1) })
    this.debugInfo.softhyphens = []
  }
  for (let match of softHyphenWords) {
    let word = match.split('\xAD').join('')
    if (!wordlist.includes(word) && !wordlist.includes(word.toLowerCase())) {
      word = match.split('\xAD').join('-')
    }
    this.content = this.content.replace(match, word)
    this.meta._softHyphenWords += `${word} | `
    if (this.debug) {
      this.debugInfo.softhyphens.push(`${match}\t${word}`)
    }
  }
}

OceanMarkdown.prototype.toString = function() {
  this.checkMeta()
  // Return the string of the document
  return matter.stringify(this.content, this.meta)
}

/**
 * Replace all instances of a string, regex string, or array of strings with another string.
 * @param {*} o The string, regex string, or array of strings or regex strings to replace
 * @param {*} r The replacement text or regex string
 * @param {*} pre Regex string prefix to prepend to the search string
 * @param {*} post Regex string suffix to postpend to the search string
 */
OceanMarkdown.prototype.replaceAll = function(search, replace = false, pre = '', post = '') {
  if (typeof replace === 'string') {
    search = (typeof search === 'string' ? [search] : [...search])
    search.forEach(k => {
      this.content = this.content.replace(this.toRegExp(k, pre, post), replace)
    })
  }
  else if (typeof search === 'object' && !Array.isArray(search)) {
    Object.keys(search).forEach(k => {
      this.content = this.content.replace(this.toRegExp(k, pre, post), search[k])
    })
  }
  return this
}

OceanMarkdown.prototype.toRegExp = function(s, pre = '', post = '') {
  // Get regex string
  let r = s.match(/^\/([\s\S]+)\/([gim]*)$/m)
  // Get pattern and options
  let p = ''
  let o = 'gm'
  if (r) {
    p = r[1].replace('{pg}', '([0-9MCLXVIOmclxvi]+)').replace('{fn}', '([AEFI]?[-0-9O\\*]+)').replace('{*}', '(.+)')
    o = r[2] || o
  }
  else {
    p = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    p = p.replace('\\{pg\\}', '([0-9MCLXVIOmclxvi]+)').replace('\\{fn\\}', '([AEFI]?[-0-9O\\*]+)').replace('\\{\\*\\}', '(.+)')
  }
  p = pre + p + post
  return new RegExp(p, o)
}

OceanMarkdown.prototype._loadUrl = function(url) {
  const request = require('request')
  const cachedRequest = require('cached-request')(request).setValue('ttl', (60*60*24*30))
  let doc = ''
  cachedRequest({url: url}, (err, res, _) => {
    if (err) {
      throw err
    }
    doc = _
  })
  return doc
}

OceanMarkdown.prototype._loadFile = function(filePath, encoding = false) {
  if (/\n/.test(filePath) || (filePath.length > 2048)) {
    return false
  }
  
  if (isUrl(filePath)) return this._loadUrl(filePath)

  filePath = path.resolve(process.cwd(), filePath)

  // Check if filePath exists
  if (!sh.test('-f', filePath)) {
    return false
  }

  // Load the file into a buffer
  let fileBuffer = fs.readFileSync(filePath)

  // For .md files, just use UTF-8
  if (!encoding && /\.md$/.test(filePath)) {
    return {
      encoding: encoding,
      content: iconv.decode(fileBuffer, 'UTF-8')
    }
  }

  // If no encoding is specified, try to detect it
  if (encoding === 'detect' || !encoding || encoding === true) {
    encoding = chardet.detect(fileBuffer)
  }

  return {
    encoding: encoding,
    content: iconv.decode(fileBuffer, encoding)
  }

}

OceanMarkdown.prototype.checkMeta = function() {

  // Upgrade from previous versions
  if (typeof this.meta.ocnmd_version === 'undefined') {

    this.meta.access = (this.meta.encumbered ? 'encumbered' : 'research')
    delete this.meta.encumbered
    delete this.meta.status

    if (typeof this.meta.source === 'string' && this.meta.source) {
      this.meta.publicationName = this.meta.source.replace(/, (?:pages?|pg|vol).+/i, '')
    }
    delete this.meta.source
    
    if (typeof this.meta.language === 'undefined') this.meta.language = 'en'

    if (typeof this.meta.priority !== 'number') this.meta.priority = 9

    if (typeof this.meta.image === 'string') this.meta.coverUrl = this.meta.image
    delete this.meta.image

    if (this.meta.url) this.meta.sourceUrl = this.meta.url
    delete this.meta.url

    if (this.meta.collection) this.meta.collectionTitle = this.meta.collection
    delete this.meta.collection

    if (this.meta.collectionImage) this.meta.collectionCoverUrl = this.meta.collectionImage
    delete this.meta.collectionImage

    if (typeof this.meta.date === 'number' && this.meta.date < 2050) {
      this.meta.year = this.meta.date
    }
    else if (this.meta.date && /\d{4}/.test(this.meta.date)) { 
      this.meta.year = this.meta.date.match(/(\d{4})/)[1]
    }
    delete this.meta.date

    if (this.meta.doctype) this.meta.documentType = this.meta.doctype
    delete this.meta.doctype

    if (typeof this.meta.audio === 'string' && this.meta.audio.length) {
      this.meta.audioUrl = this.meta.audio
      this.meta.audio = true
    }
    else if (typeof this.meta.audioUrl === 'string' && this.meta.audioUrl.length) {
      this.meta.audio = true
    }
    else {
      delete this.meta.audio
    }

    if (typeof this.meta.author === 'string' && this.meta.author.length) {
      this.meta.author = new BahaiAutocorrect(this.meta.author).correct().stripUnderlines().toString()
    }
    else {
      this.meta.author = ''
    }

    if (typeof this.meta.title === 'string' && this.meta.title.length) {
      this.meta.title = new BahaiAutocorrect(this.meta.title).correct().stripUnderlines().toString()
    }
    else {
      this.meta.title = ''
    }

  }

  // Save ocnmd_version
  this.meta.ocnmd_version = 1

  // Capture the word count in the poorly-named meta.wordsCount
  this.meta.wordsCount = this.content.match(/\s+/gm).length // TODO: get a more accurate word count

  // Create a collection id if there is none
  if (this.meta.collectionTitle && !this.meta.collectionId) {
    this.meta.collectionId = tr(this.meta.collectionTitle)
  }

  // Remove blank encoding
  if (this.meta._conversionOpts.encoding === '') delete this.meta._conversionOpts.encoding

  // Ensure that the document has an ID
  if (typeof this.meta.id === 'undefined' || !this.meta.id || this.meta.id === '') {
    let trOptions = {
      ignore: [':'],
    }
    let rawId = [(this.meta.author || this.meta.publicationName || 'unknown'), (this.meta.titleEn || this.meta.title).replace(':', ' '), this.meta.language].join(':')
      .replace(/[_‘’'\(\)]/g, '')
    this.meta.id = tr(rawId, trOptions)
      .replace(/:(?:a|an|the)-/, ':')
      .replace(/-(?:and|but|or|nor|for|a|an|the|some|on|of)-/g, '-')
      .replace(/-(?:and|but|or|nor|for|a|an|the|some|on|of)-/g, '-')
      .replace(/-?:-?/g, ':')
  }

}

OceanMarkdown.prototype.prepareRaw = function(data) {
  this.raw = data
}

module.exports = OceanMarkdown