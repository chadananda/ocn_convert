/**
 * @fileOverview
 * Provides a class for creating ocean markdown.
 * 
 * Meta information is as follows:
 * 
id                  | string      | yes       | a unique string that describes the document
title               | string      | yes       | the title of the document, in the language of the document
titleShort          | string      |           | a short title that won't break mobile design
titleAbrv           | string      |           | title abbreviation, e.g. GWB for Gleanings from the Writings of Baha'u'llah
titleEn             | string      | yes*      | the title of the work, in English (required for books in other languages)
author              | str/array   | yes       | the author of the document
access              | enum        | yes       | either "research", or "encumbered" for documents that cannot be scrolled.
language            | string      | yes       | the two-character language code of the document
searchLang          | array       |           | an array of language codes to search for the document
priority            | int, 5-10   | yes       | how important it is (1 = most, 10 = least)
wordsCount          | int         | yes       | word count of the document
sourceUrl           | string      |           | a link to the content, for display in search results
year                | int         |           | the year that the document was written
 | | | 
audio               | boolean     |           | whether the item has audio
audioUrl            | str/array   |           | url(s) linking to the audio file(s)
authorAbrv          | string      |           | abbreviated author name, only for central figures
category            | enum        |           | the religion to which the content relates (@TODO: get category names)
collectionCoverURL  | string      |           | url linking to the image for the collection
collectionId        | string      |           | a unique id for the collection, comprising the collectionTitle lowercased and dashed
collectionTitle     | string      |           | the title for the collection
coverUrl            | string      |           | url linking to the representative image
documentType        | enum        |           | a document type (@TODO: define document types)
editor              | str/array   |           | who edited the document
narrator            | str/array   |           | the narrator for the audio file
needsEditing        | boolean     |           | if the text quality is bad, e.g. from OCR, mark this as true
originalLang        | string      |           | the original language from which the translation was made
publicationName     | string      |           | the name of the publication in which this document appeared
publicationEdition  | string      |           | the edition of a book
translationRef      | string      |           | a string that is consistent across translations of a single document
translator          | str/array   |           | who translated the document
 */
const BahaiAutocorrect = require('bahai-autocorrect')
const matter = require('gray-matter')
const wordlist = [...require('an-array-of-english-words'), ...require('an-array-of-french-words')]

class OceanMarkdown{

  /**
   * Class for creating Ocean Markdown files
   * @param {string} input Existing ocean markdown, or raw data
   * @param {object} opts The options to use when converting to markdown
   * @param {object} meta Metadata for the markdown file
   * @param {string} raw Raw data, if overriding the existing content
   */
  constructor(input, opts = {}, meta = {}, raw = '') {

    // Set up conversion option types
    this.optionTypes = {}
    this.defaultConversionOpts = {}

    // Set default conversion options
    this.addDefaultConversionOpts({
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

    // Get the text (fromInput.content) and meta if available (fromInput.data)
    let fromInput = matter(input)

    // Set up the required meta fields
    this.meta = Object.assign({
      id: '', // TODO: set ID
      title: '',
      author: '',
      access: 'encumbered',
      language: 'en',
      wordsCount: 0,
      _conversionOpts: {},
    }, fromInput.data || {}, meta)

    // Soft hyphen words are calculated every time
    this.meta._softHyphenWords = ''

    // Set new conversion options for saving
    this.meta._conversionOpts = this.mergeOptions(this.meta._conversionOpts, opts)

    // Get the full list of options for conversion
    this.opts = this.mergeOptions(this.defaultConversionOpts, this.meta._conversionOpts)

    // Set up for debugging
    this.debug = opts.debug
    this.debugInfo = {}

    // Set up raw and content
    this.raw = raw || fromInput.content || ''
    this.content = fromInput.content || this.raw

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
  // Reset content
  this.content = this.raw

  this.cleanupText().replaceAll(this.opts.prePatterns)

  if (this.opts.correctSoftHyphens) {
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
  this.meta.wordsCount = this.content.match(/\s+/gm).length
  if (this.meta.id === '') {
    this.meta.id = ((this.meta.titleEn || this.meta.title) + '-' + this.meta.language)
      .replace(/[Áá]/g, 'a')
      .replace(/[Íí]/g,'i')
      .replace(/[Úú]/g, 'u')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^-_\w]/g, '')
  }
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
    p = r[1].replace('{pg}', '([0-9MCLXVImclxvi]+)').replace('{fn}', '([-A-Z0-9\\*]+)').replace('{*}', '(.+)')
    o = r[2] || o
  }
  else {
    p = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    p = p.replace('\\{pg\\}', '([0-9MCLXVImclxvi]+)').replace('\\{fn\\}', '([-A-Z0-9\\*]+)').replace('\\{\\*\\}', '(.+)')
  }
  p = pre + p + post
  return new RegExp(p, o)
}

module.exports = OceanMarkdown