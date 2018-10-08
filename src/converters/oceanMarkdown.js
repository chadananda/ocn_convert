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
const tr = require('transliteration').slugify
const iconv = require('iconv-lite')
const chardet = require('chardet')
const { crc32 } = require('crc')

const metaTemplate = {
  // id: (should not be set or changed by scripts)
  access: ['research', 'encumbered'],
  author: ['string'],
  language: ['string'],
  priority: [5,6,7,8,9,10],
  title: 'string',
  titleShort: 'string',
  ocnmd_version: 'number',
  sourceUrl: 'string',
  wordsCount: 'number',
  category: 'string',
  coverUrl: 'string',
  documentType: 'string',
  editor: ['string'],
  needsEditing: 'boolean',
  publicationName: 'string',
  publicationEdition: 'string',
  year: 'number',
  authorAbrv: 'string',
  titleAbrv: 'string',
  collectionTitle: 'string',
  collectionId: 'string',
  collectionCoverUrl: 'string',
  titleEn: 'string',
  originalLang: 'string',
  searchLang: ['string'],
  translationRef: 'string',
  translator: ['string'],
  audio: 'boolean',
  audioUrl: ['string'],
  narrator: ['string'],
  _convertedFrom: 'string'
}

class OceanMarkdown{

  /**
   * Class for creating Ocean Markdown files.
   * @param {string} input Raw data to be converted
   * @param {object} opts The metadata and conversion options to use
   */
  constructor(input, opts = {}) {

    // CORRECT IMPROPER FRONT MATTER
    if (opts.fixMeta) input = this.fixMeta(input)

    // RAW DATA
    let fromInput = matter(input)
    this.raw = fromInput.content || ''

    // METADATA ERROR CHECKING
    this.metaErrors = []

    // METADATA
    this.meta = Object.assign({
      id: '',
      title: '',
      author: '',
      access: 'encumbered',
      language: 'en',
      priority: 10,
      wordsCount: 0,
      _conversionOpts: {},
    }, fromInput.data || {})
    this.mergeMeta(opts)

    // CONVERSION OPTIONS
    this.optionTypes = {}
    this.defaultConversionOpts = {}
    this.addDefaultConversionOpts({
      pgExp: '([0-9MDCLXVIOmdclxvi]+)',
      fnExp: '([a-zA-Z]?[-0-9_Ol\\*]+)',
      footnotesPerPageExp: `/\\[pg {pg}\\]((?:(?!\\[pg)[\\s\\S])*?)\\[\\^{fn}\\]/m`,
      starExp: '(.+)',
      converter: 'text',
      encoding: 'UTF-8',
      reconvert: true,
      correctBahaiWords: true,
      correctSoftHyphens: true,
      footnotesPerPage: false,
      prePatterns: {
        "/ah([aá])(['`’‘])I/": 'ah$1$2í'
      },
      postPatterns: {
        '/<[uU]>([CDGKSTZcdgkstz])([hH])<\/[uU]>/': '$1_$2', // can't strip the <u> tags until the end, because it messes up italics determination
        '/\\n(?:[\\n ]+)*\\n/': '\n\n', // condense all multiple linebreaks into just two
      },
      cleanupPatterns: {
        // Line breaks
        '/\r\n/': '\n',
        '/\r/': '\n',
        // Trailing spaces
        '/[ \t]+$/': '',
        // Soft hyphens
        '/(\\d+)\xAD(\\d+)/': '$1-$2',
        '/[-\xAD]{2,}/': '--',
        '/ \xAD /': ' - ',
      },
      skip: false
    })
    this.mergeAllOptions(opts)

    // DEBUGGING
    this.debug = opts.debug
    this.debugInfo = {}

    // CONTENT
    this.content = ''

    // VERBOSE LOGGING
    if (opts.v) {
      console.log (Object.assign({}, this, {raw: this.raw.length + ' chars',content: this.content.length + ' chars'}))
    }
  }
}

OceanMarkdown.prototype.init = async function() {
  return this
}

  /**
   * 
   * @param {stream} stream The stream to be used when preparing content for the OceanMarkdown object
   * @param {*} opts 
   */
OceanMarkdown.prototype.prepareStream = async function(stream, opts = {}) {
  let textBuffer = await require('raw-body')(stream)

  encoding = (typeof opts.encoding === 'string' ? opts.encoding : chardet.detect(textBuffer))

  return {
    encoding: encoding,
    content: iconv.decode(textBuffer, encoding),
  }
}

OceanMarkdown.prototype.mergeAllOptions = function(opts) {
  // Set conversion options for saving
  this.meta._conversionOpts = this.mergeOptions(this.meta._conversionOpts || {}, opts || {})
  // Get the full list of options for conversion
  this.opts = this.mergeOptions(this.defaultConversionOpts, this.meta._conversionOpts || {})
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
    else if ((!Array.isArray(existing[k]) && typeof merging[k] !== type) || (Array.isArray(existing[k]) && !Array.isArray(merging[k]))) {
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

OceanMarkdown.prototype.mergeMeta = function(merge) {
  Object.keys(metaTemplate).forEach(function(k) {
    let type = typeof merge[k]
    if (type !== 'undefined') {
      // If metatemplate has an array of values
      if (Array.isArray(metaTemplate[k])) {
        // If the merge data is an array, test that the type of each is correct
        if (Array.isArray(merge[k])) {
          let newValue = []
          for (let v of merge[k]) {
            if (metaTemplate[k].indexOf(typeof v) !== -1) newValue.push(v)
          }
          if (newValue.length) this.meta[k] = newValue
        }
        else if ((metaTemplate[k].indexOf(type) !== -1) || (metaTemplate[k].indexOf[merge[k]] !== -1)) {
          this.meta[k] = merge[k]
        }
      }
      // If the type of data to be merged matches the template, merge it
      else if (type === metaTemplate[k]) {
        this.meta[k] = merge[k]
      }
    }
  }.bind(this))
}

OceanMarkdown.prototype.fixMeta = function(input) {
  let testMatter = input.match(/^([\s\S]*?)(?:\.{2,6}|---)\s*(\n[\s\S]+?\n*)(?:\s*\n\.{2,6}|---)\s*\n/m)
  if (Array.isArray(testMatter) && testMatter[1] === "" && !/\n\n/.test(testMatter[2])) {
    let newMatter = ('---' + testMatter[2] + '\n---\n')
      // fix double line breaks, in case there was an extra one at the end of the front matter.
      .replace('\n\n', '\n')
      // fix lines that are only quotation marks (this happens if we've previously messed it up)
      .replace(/^( *)([\w_]+|'[^']'): ['"]('+)['"]$/mg, '$1$2: >-\n$1  ')
      // Fix lines with multiple values on one line
      .replace(/^( *)(author|translator): '?(.*[- á].*, .*[- á].*[^'])'?$/gm, (t, sp, name, val) => {
        return `${sp}${name}:\n${sp}  - ${val.split(',').join(`\n${sp}  - `)}`
      })
      // fix lines with apostrophes, quotes, brackets, and colons
      .replace(/^( *)([\w_]+|'[^']'): ['"](.*)['"]$/mg, (t, p1, p2, p3) => {return `${p1}${p2}: >-\n${p1}  ${p3.replace(/'+/g, "'")}`})
      .replace(/^( *)([\w_]+|'[^']'): (.*?['"\[\]:].*)$/mg, '$1$2: >-\n$1  $3')
      // fix lines with no value
      .replace(/^( *(?:[\w_]+|'[^']')): *\r?\n(?! {2,}(?:[\w_]+:|'|-))/mg, '$1: \'\'\n')
      // fix lines with values that are followed by un-indented multi-line values
      .replace(/^([\w_]+|'[^']'): (.{3,}\r?\n)(?![\w_]+: |'[^']': |---)/gm, '$1: |\n  $2')
      .replace(/^((?![\w_]+:[ \r\n]| '[^']':[ \r\n]|---)[^\s\r\n']+)/gm, '  $1')
      // fix lines that have multiple apostrophes
      .replace(/^( +)'''(.+)\n(.+)'''/gm, '$1$2$3')
    // replace broken YFM with fixed
    return input.replace(testMatter[0], newMatter)
  }
  return input
}

OceanMarkdown.prototype.convert = function() {
  // Option to skip files
  if (this.opts.skip) {
    this.content = ''
    return this
  }

  // Reset content
  this.prepareContent()

  // Execute the conversion functions
  this._preConvert()
  this._convert()
  this._postConvert()

  return this
}

OceanMarkdown.prototype._convert = function() {
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
OceanMarkdown.prototype._preConvert = function() {
  return this
}
OceanMarkdown.prototype._postConvert = function() {
  if (this.opts.footnotesPerPage) {
    this.footnotesPerPage()
  }
  return this
}

OceanMarkdown.prototype.cleanupText = function() {
  this.replaceAll(this.opts.cleanupPatterns)
  return this
}

OceanMarkdown.prototype.footnotesPerPage = function() {
  while (this.toRegExp(this.opts.footnotesPerPageExp).test(this.content)) {
    this.replaceAll(this.opts.footnotesPerPageExp, '[pg $1]$2[^fn_$1_$3]')
  }
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
      this.content = this.content.replace(this.toRegExp(k, pre, post), _normalizeRegexReplacements(replace))
    })
  }
  else if (typeof search === 'object' && !Array.isArray(search)) {
    Object.keys(search).forEach(k => {
      if (search[k] || search[k] === '') this.content = this.content.replace(this.toRegExp(k, pre, post), _normalizeRegexReplacements(search[k]))
    })
  }
  return this
}

function _normalizeRegexReplacements(text) {
  return text.replace(/\\n/g, '\n').replace(/\\t/g, '\t')
}

OceanMarkdown.prototype.toRegExp = function(s, pre = '', post = '') {
  // Get regex string
  let r = s.match(/^\/([\s\S]+)\/([gim]*)$/m)
  // Get pattern and options
  let p = ''
  let o = 'gm'
  if (r) {
    p = r[1].replace('{pg}', this.opts.pgExp).replace('{fn}', this.opts.fnExp).replace('{*}', this.opts.starExp)
    o = r[2] || o
  }
  else {
    p = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    p = p.replace('\\{pg\\}', this.opts.pgExp).replace('\\{fn\\}', this.opts.fnExp).replace('\\{\\*\\}', this.opts.starExp)
  }
  p = pre + p + post
  return new RegExp(p, o)
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

  }
  else {
    switch(this.meta.ocnmd_version) {
      case 1:
        this.meta.id = '' // Recalculate all ids because colons cause problems if used as filenames
        break;
    }
  }

  // Save ocnmd_version
  this.meta.ocnmd_version = 2

  // Correct author and title
  for (let k of ['author', 'title']) {
    if (typeof this.meta[k] === 'undefined') this.setMetaError(k)
    else if (typeof this.meta[k] === 'string' && this.meta[k]) {
      this.meta[k] = new BahaiAutocorrect(this.meta[k]).correct().stripUnderlines().toString()
    }
    else if (Array.isArray(this.meta[k]) && this.meta[k].length) {
      this.meta[k] = this.meta[k].map(v => { return new BahaiAutocorrect(v).correct().stripUnderlines().toString() })
    }
    else {
      this.setMetaError(k)
    }
  }

  // Capture the word count in the poorly-named meta.wordsCount
  this.meta.wordsCount = /\s/.test(this.content) ? this.content.match(/\s+/gm).length : this.meta.wordsCount // TODO: get a more accurate word count

  // Create a collection id if there is none
  if (this.meta.collectionTitle && !this.meta.collectionId) {
    this.meta.collectionId = tr(this.meta.collectionTitle)
  }

  // Remove blank encoding
  if (this.meta._conversionOpts.encoding === '') delete this.meta._conversionOpts.encoding

  // Ensure that the document has an ID if other fields are ready
  if (this.meta.title && (this.meta.author || this.meta.publicationName) && (typeof this.meta.id === 'undefined' || !this.meta.id || this.meta.id === '')) {
    let trOptions = {
      ignore: ['_'],
    }
    let rawId = `${(this.meta.author || this.meta.publicationName || 'unknown')}::${(this.meta.titleEn || this.meta.title).replace(':', ' ')}::${crc32(this.content)}::${this.meta.language}`
      .replace(/[_‘’'\(\)]/g, '').replace(/::/g, '__')
    this.meta.id = tr(rawId, trOptions)
      .replace(/__(?:a|an|the)-/, '__')
      .replace(/-(?:and|but|or|nor|for|a|an|the|some|on|of)-/g, '-')
      .replace(/-(?:and|but|or|nor|for|a|an|the|some|on|of)-/g, '-')
      .replace(/-?__-?/g, '__')
  }

  for (let k of ['access', 'language', 'priority', 'id']) {
    if (!(
      (
        typeof this.meta[k] !== metaTemplate[k] &&
        this.meta[k]
      )
      ||
      (
        Array.isArray(metaTemplate[k]) &&
        (
          metaTemplate[k].indexOf(this.meta[k]) ||
          metaTemplate[k].indexOf(this.meta[k][0])
        )
      )
    )) this.setMetaError(k)
  }
  if (this.meta.id.length > 255) this.setMetaError('id')

}

OceanMarkdown.prototype.prepareContent = function() {
  if (!this.raw) {
    console.error(`Error: "${this.meta._convertedFrom}" does not exist on your system, and you have requested to reconvert it. You can either:
    1. change the "_convertedFrom" metadata in "${this.filePath}", or
    2. go to the folder where the document is and convert it again with this option:
    -p "${path.dirname(this.filePath)}"`)
    return this
  }

  this.content = this.raw
  return this
}

OceanMarkdown.prototype.getConverter = async function(contentType, stream, opts) {
  return require('../index').getConverter(contentType, stream, opts || {})
}

OceanMarkdown.prototype.setMetaError = function(key) {
  if (this.metaErrors.indexOf(key) === -1) this.metaErrors.push(key)
}

module.exports = OceanMarkdown