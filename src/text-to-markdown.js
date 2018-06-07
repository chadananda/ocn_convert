const BahaiAutocorrect = require('bahai-autocorrect')
const matter = require('gray-matter')
const wordlist = [...require('an-array-of-english-words'), ...require('an-array-of-french-words')]
const defaults = {

  // Correct Bahá'í Words
  correctBahaiWords: true,

  // Chapters
  chPattern: {},
  chReplacement: '## $1. $2',

  // Footnotes
  fnRefPattern: {
    '[{fn}](\s)': '[^$1]$2',
    '+F{fn}': '[^$1]'
  },
  fnRefReplacement: '[^$1]',
  fnTextPattern: {
    '/^\\[{fn}\\.? {*}\\]/': '[$1]: $2',
    '/^([0-9]+). \\[{*}\\]$/': '[$1]: $2',
    '/^\\.{10} ?\\[{fn}\\.? {*}\\]/': '[$1]: $2',
  },
  fnTextReplacement: '[$1]: $2',

  // Headers
  headersCentered: false,

  // Page Numbers
  pgNumberFrom: false,
  pgPattern: {
    '|PPage_{pg}': '[pg $1]',
    '<p{pg}>': '[pg $1]',
    '+P{pg}': '[pg $1]',
    '+p': '[pg]',
    '+P': '[pg]',
  },
  pgReplacement: '[pg $1]',
  pgInText: false,

  // Paragraphs
  pIndent: [
  ],
  pIndentFirst: [
    '\t', // Just a tab
    '/ {1,4}(?! )/', // Exactly one to four spaces
    '/\\.{5}(?!\\.) ?/' // five periods, possibly followed by a space
  ],
  pNumbers: false,

  // Blockquotes
  qIndent: [
    '/(>?) ?(?: {1,4}|\t)/', // One to four spaces, or a tab character
    '/(>?) ?\\.{10} ?/', // Ten periods 
    '/(>) \\.{5} ?/', // A quote with five periods (for multi-level quotes)
  ],
  qIndentFirst: [
  ],

  toLineBreaks: [
    '/^\\[?\\.\\]?\\s*\\[?\\.\\/\\/\\]?[ \\t]*/', // Some files have lines like [.] [.//]
    '/^\\[?\\.\\/\\/\\/\\]?\\s*\\[?\\.\\]?[ \\t]*/', // Some files have lines like [.///] [.]
  ],

  prePatterns: {
    "/ah([aá])(['`’‘])I/": 'ah$1$2í'
  },

  postPatterns: {
    '/(\\{ *| *\\})/': '_', // In some formats, italics are signified by {braces}
    '/^>* _[^_\\n]+$/': '$&_', // Sometimes italics are not closed at the end of a blockquote line
    '/^(>* )([^_\\n]+_)$/': '$1_$2', // Sometimes italics are not opened at the beginning of a blockquote line
    '/^>* _[^_\\n]+_[^_\\n]+_[^_\\n]+$/': '$&_', // Again, sometimes italics are not closed at the end of a blockquote line
    '/^<nd>$/': '---', // Some documents have this <nd> tag, which seems to be a separator of some kind
    '/<[uU]>([CDGKSTZcdgkstz])([hH])</[uU]>/': '$1_$2', // Baha'i words with underlines
  }

}

const cleanupPatterns = {
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

function escRegex(t) {
  return (t.match(/^\/.+\/$/) ? t.replace(/^\/(.+)\/$/, '$1') : t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
}

class TextToMarkdown {

  /**
   * Convert Text to Markdown
   * 
   * @param {string} text
   * the text to be replaced
   * 
   * @param {*} opts 
   * the options to use when converting text, including:
   * --pageMarker (string): the pattern of page markers in the document
   */
  constructor(text, opts = {}, meta = {}) {

    // Set up basic properties
    this.raw = text
    this.text = text
    this.fnPatterns = []
    this.pgPatterns = []
    this.chPatterns = []
    this.prePatterns = []
    this.postPatterns = []
    this.debug = opts.debug
    this.debugInfo = {}

    // Set up meta property
    this.meta = Object.assign({
      title: '',
      author: '',
      language: '',
      source: '',
      date: '',
      doctype: '',
      status: '',
      encumbered: false,
      collection: '',
      _conversionOpts: {},
    }, matter(this.raw).data || {}, meta)
    this.meta._softHyphenWords = ''

    // Include all options from command parameters
    Object.keys(opts).forEach(function(k) {
      if (defaults.hasOwnProperty(k)) this.meta._conversionOpts[k] = opts[k]
    }.bind(this))

    // Include all patterns for before conversion from file header
    let misc = Object.assign({}, defaults.prePatterns, this.meta._conversionOpts.prePatterns || {})
    Object.keys(misc).forEach(function(k) {
      if (misc[k] !== false) {
        this.prePatterns.push({
          pattern: this._toRegExp(k),
          replacement: misc[k]
        })
      }
    }.bind(this))

    // Include all patterns for after conversion from file header
    misc = Object.assign({}, defaults.postPatterns, this.meta._conversionOpts.postPatterns || {})
    Object.keys(misc).forEach(function(k) {
      if (misc[k] !== false) {
        this.postPatterns.push({
          pattern: this._toRegExp(k),
          replacement: misc[k]
        })
      }
    }.bind(this))

    // Set opts from conversion options
    this.opts = Object.assign(defaults, this.meta._conversionOpts)

    // Set up pattern arrays for footnotes, pages, chapters
    for (let o of ['fnRef', 'fnText', 'pg', 'ch']) {
      let prop = o.substr(0,2) + 'Patterns'
      let opt = o + 'Pattern'
      if (this.opts[opt]) {
        if (typeof(this.opts[opt]) === 'string') {
          this[prop].push({
            pattern: this._toRegExp(this.opts[opt]),
            replacement: this.opts[o + 'Replacement']
          })
        }
        else {
          Object.keys(this.opts[opt]).forEach(k => {
            this[prop].push({
              pattern: this._toRegExp(k),
              replacement: this.opts[opt][k],
            })
          })
        }
      }
    }

    // Log the current object if in verbose mode
    if (opts.v) {
      console.log (Object.assign({}, this, {raw: this.raw.length + ' chars',text: this.text.length + ' chars'}))
    }
  }
}

TextToMarkdown.prototype.convert = function() {
  if (this.opts.skip) {
    this.text = ''
    return
  }

  this.text = this.raw

  // Basic cleanup
  Object.keys(cleanupPatterns).forEach(k => {
    this.text = this.text.replace(this._toRegExp(k), cleanupPatterns[k])
  })
  
  let softHyphenWords = []
  if (this.text.match('\xAD')) {
    // This regex finds all soft-hyphenated words and adds them to the index for each file.
    this.text.replace(/["“\'\(\[_`‘]*(\S+\xAD\S+?)["“\)\]\*\+\'`‘!?.,;:_\d]*(?!\S)/gm, (m, p1) => { softHyphenWords.push(p1) })
    this.debugInfo.softhyphens = []
  }
  for (let match of softHyphenWords) {
    let word = match.split('\xAD').join('')
    if (!wordlist.includes(word) && !wordlist.includes(word.toLowerCase())) {
      word = match.split('\xAD').join('-')
    }
    this.text = this.text.replace(match, word)
    this.meta._softHyphenWords += `${word} | `
    if (this.debug) {
      this.debugInfo.softhyphens.push(`${match}\t${word}`)
    }
  }

  // Run pre-convert patterns
  for (let p of [...this.prePatterns]) {
    this.text = this.text.replace(p.pattern, p.replacement)
  }

  // Run Baha'i Autocorrect
  if (this.opts.correctBahaiWords) {
    let bahaiAutocorrect = new BahaiAutocorrect(this.text, false, this.debug)
    bahaiAutocorrect.correct()
    this.text = bahaiAutocorrect.toString()
    if (this.debug) {
      this.debugInfo.bahai = [...new Set(bahaiAutocorrect.diff.split('\n'))]
    }
  }

  // Handle paragraphs
  this._replaceAll('pIndent', '', '^')
  this._replaceAll('pIndentFirst', '\n', '^')

  this._replaceAll('toLineBreaks', '\n')

  // Handle chapters, footnotes, and pages
  for (let p of [...this.chPatterns, ...this.fnPatterns, ...this.pgPatterns]) {
    this.text = this.text.replace(p.pattern, p.replacement)
  }

  // Handle blockquotes
  this._replaceAll('qIndent', '$1> ', '^')
  this._replaceAll('qIndentFirst', '\n> ', '^')

  // Run post-convert patterns
  for (let p of [...this.postPatterns]) {
    this.text = this.text.replace(p.pattern, p.replacement)
  }

  // Remove multiple line breaks
  this.text = this.text.replace(/\n[\n\s]+/gm, '\n\n')

}

TextToMarkdown.prototype._replaceAll = function(o, r, pre = '', post = '') {
  if (this.opts[o]) {
    this.opts[o] = (typeof(this.opts[o]) === 'string' ? [ this.opts[o] ] : this.opts[o])
    for (p of this.opts[o]) {
      this.text = this.text.replace(this._toRegExp(p, pre, post), r)
    }
  }
}

TextToMarkdown.prototype._toRegExp = function(s, pre = '', post = '') {
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
    p = escRegex(s)
    p = p.replace('\\{pg\\}', '([0-9MCLXVImclxvi]+)').replace('\\{fn\\}', '([-A-Z0-9\\*]+)').replace('\\{\\*\\}', '(.+)')
  }
  p = pre + p + post
  return new RegExp(p, o)
}

TextToMarkdown.prototype._parseFrontMatter = function() {
  let o = matter(this.raw)
  this.meta = o.data
  this.text = o.content
}

TextToMarkdown.prototype.toString = function() {
  return matter.stringify(this.text, this.meta)
}

module.exports = TextToMarkdown