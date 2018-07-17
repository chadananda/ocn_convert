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

class OceanMarkdown{

  /**
   * Class for creating Ocean Markdown files
   * @param {string} input Existing ocean markdown, raw data, or filepath
   * @param {object} opts The options to use when converting to markdown
   * @param {object} meta Metadata for the markdown file
   * @param {string} raw Raw data, if overriding the existing content
   */
  constructor(input, opts = {}, meta = {}, raw = '') {
    let encoding = opts.E || false
    let file

    // If the input is a filename, get the actual data
    if ((file = this._loadFile(input, encoding)) !== false) {
      this.filePath = path.resolve(process.cwd(), input)
      encoding = file.encoding
      input = file.content
    }

    // Get the text (fromInput.content) and meta if available (fromInput.data)
    let fromInput = matter(input)

    // Set the content
    this.content = fromInput.content || ''

    // For new conversions, save the encoding if necessary
    if (encoding !== 'UTF-8') {
      opts.encoding = encoding
    }

    // Set up conversion option types
    this.optionTypes = {}
    this.defaultConversionOpts = {}

    // Set default conversion options
    this.addDefaultConversionOpts({
      encoding: 'UTF-8',
      reconvert: true,
      correctBahaiWords: true,
      correctSoftHyphens: true,
      prePatterns: {
        "/ah([aá])(['`’‘])I/": 'ah$1$2í'
      },
      postPatterns: {
        '/\\n[\\n\\s]+/': '\n\n',
        '/<[uU]>([CDGKSTZcdgkstz])([hH])</[uU]>/': '$1_$2', // Baha'i words with underlines
      }
    })

    // Text cleanup patterns that will apply for all source types
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

    // Set up the required meta fields
    this.meta = Object.assign({
      id: '', // TODO: set ID
      title: '',
      author: '',
      access: 'encumbered',
      ocnmd_version: 1,
      language: 'en',
      priority: 10,
      wordsCount: 0,
      _conversionOpts: {},
    }, fromInput.data || {}, meta)

    // Set new conversion options for saving
    this.meta._conversionOpts = this.mergeOptions(this.meta._conversionOpts, opts, {reconvert: true})

    // Get the full list of options for conversion
    this.opts = this.mergeOptions(this.defaultConversionOpts, this.meta._conversionOpts)

    // Set up for debugging
    this.debug = opts.debug
    this.debugInfo = {}

    // Get the raw data
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

    // Log the current object if in verbose mode
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
  bahaiAutocorrect.correct()
  this.content = bahaiAutocorrect.toString()
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
  // Capture the word count in the poorly-named meta.wordsCount
  this.meta.wordsCount = this.content.match(/\s+/gm).length // TODO: get a more accurate word count
  // Ensure that the document has an ID
  if (this.meta.id === '') {
    let tr = require('transliteration').slugify
    let trOptions = {
      ignore: [':'],
    }
    let rawId = [this.meta.author, (this.meta.titleEn || this.meta.title), this.meta.language].join(':')
      .replace(/[_‘’'\(\)]/g, '')
    this.meta.id = tr(rawId, trOptions)
      .replace(/:(?:a|an|the)-/, ':')
      .replace(/-(?:and|but|or|nor|for|a|an|the|some|on|of)-/g, '-')
      .replace(/-(?:and|but|or|nor|for|a|an|the|some|on|of)-/g, '-')
      .replace(/-?:-?/g, ':')
  }
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

OceanMarkdown.prototype._loadFile = function(filePath, encoding = false) {

  // Check if filePath is definitely not a file path
  if (/\n/.test(filePath) || filePath.length > 2048) {
    return false
  }

  filePath = path.resolve(process.cwd(), filePath)

  // Check if filePath exists
  if (!sh.test('-f', filePath)) {
    return false
  }
  
  // Load the file into a buffer
  let fileBuffer = fs.readFileSync(filePath)

  // If no encoding is specified, try to detect it
  if (!encoding || encoding === true) {
    encoding = chardet.detect(fileBuffer)
  }

  return {
    encoding: encoding,
    content: iconv.decode(fileBuffer, encoding)
  }

}

module.exports = OceanMarkdown