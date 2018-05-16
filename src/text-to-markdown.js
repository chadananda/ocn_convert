const bahaiAutocorrect = require('bahai-autocorrect').correct
const defaults = {
  headersCentered: true,
  // headersRepeated: false,
  // doubleSpaced: false,
  // encoding: 'utf-8',
  pageMarker: {
    '|PPage_{}': '<p{}>',
    '<p{}>': '<p{}>',
    '+P{}': '<p{}>',
    '+p': '<p>',
    '+P': '<p>',
  },
  pageMarkerReplacement: '<p{}>',
  pageMarkersInText: false,
  pIndent: false,
  pIndentFirst: new RegExp(' {1,4}'),
  pNumbers: false,
  qIndent: new RegExp(' {5,8}'),
  qIndentFirst: new RegExp(' {5,8}'),

}

function escRegex(t) {
  return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
    this.text = text
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
  this.text = bahaiAutocorrect(this.text)
  
  if (this.headersCentered) {
    this.text = this.text.replace(/^\s{13,}/g, '### ')
  }

}
