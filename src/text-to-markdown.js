const bac = require('bahai-autocorrect')
const matter = require('gray-matter')
const defaults = {

  // Chapters
  chPattern: {},
  chReplacement: '## $1. $2',

  // Footnotes
  fnRefPattern: {
    '[{fn}]': '[^$1]',
    '+F{fn}': '[^$1]'
  },
  fnRefReplacement: '[^$1]',
  fnTextPattern: {
    '/^\\[{fn}\\.? {*}\\]/': '[$1]: $2',
    '/^([0-9]+). \\[{*}\\]$/': '[$1]: $2',
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
    '\t',
    '/ {1,4}(?! )/',
    '/\\.{5}(?!\\.) ?/'
  ],
  pNumbers: false,

  // Blockquotes
  qIndent: [
    '/(?: {1,4}|\t)/',
    '/\\.{5}(?!\\.) ?/'
  ],
  qIndentFirst: [
    '/\\.{10}(?!\\.) ?/'
  ],

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
    this.miscPatterns = []

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

    // Include all options from command parameters
    Object.keys(opts).forEach(function(k) {
      if (defaults.hasOwnProperty(k)) this.meta._conversionOpts[k] = opts[k]
    }.bind(this))

    // Include all misc patterns from file header
    Object.keys(this.meta._conversionOpts.miscPatterns || {}).forEach(function(k) {
      this.miscPatterns.push({
        pattern: this._toRegExp(k),
        replacement: this.meta._conversionOpts.miscPatterns[k]
      })
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

    // Log the current object if debugging
    if (opts.d) {
      console.log (Object.assign({}, this, {raw: this.raw.length + ' chars',text: this.text.length + ' chars'}))
    }
  }
}

TextToMarkdown.prototype.convert = function() {
  this.text = this.raw
  this.text = bac.correct(this.text)

  // Standardize line breaks
  this.text = this.text.replace(/\r\n/gm, '\n').replace(/\r/gm,'')

  // Handle paragraphs
  this._replaceAll('pIndent', '', '^')
  this._replaceAll('pIndentFirst', '\n', '^')

  // Handle chapters, footnotes, and pages
  for (let p of [...this.chPatterns, ...this.fnPatterns, ...this.pgPatterns, ...this.miscPatterns]) {
    this.text = this.text.replace(p.pattern, p.replacement)
  }

  // Handle blockquotes
  this._replaceAll('qIndent', '> ', '^')
  this._replaceAll('qIndentFirst', '\n> ', '^')

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
  let r = s.match(/^\/(.+)\/([gim]*)$/)
  // Get pattern and options
  let p = ''
  let o = 'gm'
  if (r) {
    p = r[1].replace('{pg}', '([0-9MCLXVImclxvi]+)').replace('{fn}', '([-A-Z0-9\*]+)').replace('{*}', '(.+)')
    o = r[2] || o
  }
  else {
    p = escRegex(s)
    p = p.replace('\\{pg\\}', '([0-9MCLXVImclxvi]+)').replace('\\{fn\\}', '([-A-Za-z0-9]+)').replace('\\{\\*\\}', '(.+)')
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

module.exports = TextToMarkdown;