const bac = require('bahai-autocorrect')
const matter = require('gray-matter')
const defaults = {

  // Footnotes
  fnRefPattern: {
    '[{fn}]': '[^$1]',
    '+F{fn}': '[^$1]'
  },
  fnRefReplacement: '[^$1]',
  fnTextPattern: {
    '/\\[{fn}\\.? {*}\\]/': '[$1]: $2',
    '/^\\s*([0-9]+). \\[{*}\\]$/': '[$1]: $2',
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
    this.fnPatterns = []
    this.pgPatterns = []
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
    for (let o of ['fnRef', 'fnText', 'pg']) {
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

  console.log(`Patterns:\n${this.fnPatterns}\n${this.pgPatterns}`)
  for (let p of [...this.fnPatterns, ...this.pgPatterns]) {
    this.text = this.text.replace(p.pattern, p.replacement)
  }

}

TextToMarkdown.prototype._toRegExp = function(s) {
  let r = s.match(/^\/(.+)\/([gim]*)$/)
  let p = ''
  if (r) {
    p = r[1].replace('{pg}', '([0-9MCLXVImclxvi]+)').replace('{fn}', '([-A-Za-z0-9]+)').replace('{*}', '(.+)')
  }
  else {
    p = escRegex(s)
    p = p.replace('\\{pg\\}', '([0-9MCLXVImclxvi]+)').replace('\\{fn\\}', '([-A-Za-z0-9]+)').replace('\\{\\*\\}', '(.+)')
  }
  return new RegExp(p, (r ? r[2] : ''))
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