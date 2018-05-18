const bac = require('bahai-autocorrect')
const matter = require('gray-matter')
const defaults = {

  // Footnotes
  fnRefPattern: {
    '/\[([-A-Za-z0-9]+)\]/': '[^$1]',
    '/+F(\d+)/': '[^$1]'
  },
  fnRefReplacement: '[^{num}]',
  fnTextPattern: {
    '/\[([-A-Za-z0-9]+)\. (.+)/': '[$1]: $2',
    '/^\s*([0-9]+). \[.+\]$/': '[$1]: $2',
  },
  fnTextReplacement: '[{num}]: {txt}',

  // Headers
  headersCentered: true,

  // Page Numbers
  pageFirstNumber: false,
  pageMarker: {
    '|PPage_{}': '[pg \1]',
    '<p{}>': '[pg \1]',
    '+P{}': '[pg \1]',
    '+p': '[pg ]',
    '+P': '[pg ]',
  },
  pageMarkerReplacement: '[pg \1]',
  pageMarkersInText: false,

  // Paragraphs
  pIndent: false,
  pIndentFirst: new RegExp(' {1,4}'),
  pNumbers: false,

  // Blockquotes
  qIndent: new RegExp(' {5,8}'),
  qIndentFirst: new RegExp(' {5,8}'),

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
  constructor(text, opts = {}) {
    this.raw = text
    this.text = text
    this.meta = {
      title: '',
      author: '',
      language: '',
      source: '',
      date: '',
      doctype: '',
      status: '',
      encumbered: false,
      collection: ''
    }
    this.opts = Object.assign(defaults, opts)
    if (typeof(this.opts.pageMarker) === "string") {
      this.opts.pageMarker = Object.assign({[this.opts.pageMarker]: this.opts.pageMarkerReplacement })
    }
  }



}

TextToMarkdown.prototype.pageMarkerRegExp = function(s) {
  s = escRegex(s)
  s = s.replace('\\{\\}','([0-9MCLXVImclxvi]+)')
  if (!this.opts.pageMarkersInText) {
    s = '[\r\n\f\s]+' + s + '[\r\n\f\s]+'
  }
  return new RegExp(s,'gm')
}

TextToMarkdown.prototype.convert = function() {
  this.text = this.raw
  this.text = bac.correct(this.text)
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