const OceanMarkdown = require('./oceanMarkdown.js')
const utf8 = require('utf8')

class TextToMarkdown extends OceanMarkdown {

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
  constructor(input, opts = {}) {

    // Fix single-entry patterns from parameters before building object
    for (let x of ['ch', 'fnRef', 'fnText', 'pg']) {
      if (opts[x + 'Pattern']) {
        let p = opts[x + 'Pattern']
        opts[x + 'Patterns'][p] = (opts[x + 'Replacement'] || '## $1')
        opts[x + 'Pattern'] = ''
      }
    }

    super(input, opts)

    this.addDefaultConversionOpts({
      converter: 'text',

      // Chapters
      chPatterns: {},
      chPattern: '',
      chReplacement: '## $1',

      // Footnotes
      fnRefPatterns: {
        '/\\[{fn}\\](\\s)/': '[^$1]$2',
        '+F{fn}': '[^$1]',
      },
      fnRefPattern: '',
      fnRefReplacement: '[^$1]',
      fnTextPatterns: {
        '/^>?\\s*[\\[\\{]\\^?{fn}[\\]\\}] {*}/': '[^$1]: $2',
        '/^>?\\s*\\[{fn}\\.? {*}\\]/': '[^$1]: $2',
        '/^>?\\s*([0-9]+). \\[{*}\\]$/': '[^$1]: $2',
        '/^>?\\s*\\.{10} ?\\[{fn}\\.? {*}\\]/': '[^$1]: $2',
      },
      fnTextPattern: '',
      fnTextReplacement: '[^$1]: $2',

      // Headers
      headersCentered: false,

      // Page Numbers
      pgPatterns: {
        '|PPage_{pg}': '[pg $1]',
        '<p{pg}>': '[pg $1]',
        '+P{pg}': '[pg $1]',
        '/\\{\\{p?{pg}\\}\\}/': '[pg $1]',
        '+p': '[pg]',
        '+P': '[pg]',
      },
      pgPattern: '',
      pgReplacement: '[pg $1]',
      // TODO: some documents have only page markers, with no numbers
      pgNumberFrom: 0,
      // TODO: some documents have page markers inside paragraphs
      pgInText: false,

      // Paragraphs
      pIndent: [
      ],
      pIndentFirst: [
        '\t', // Just a tab
        '/ {1,4}(?! )/', // Exactly one to four spaces
        '/\\.{5}(?!\\.) ?/' // five periods, possibly followed by a space
      ],
      // TODO: some documents have paragraph numbers
      pNumbers: false,

      // Blockquotes
      qIndent: [
        '/(>?) ?(?: {1,4}|\\t)/', // One to four spaces, or a tab character
        '/(>?) ?\\.{10} ?/', // Ten periods
        '/(>) \\.{5} ?/', // A quote with five periods (for multi-level quotes)
      ],
      qIndentFirst: [
      ],

      toLineBreaks: [
        '/^\\[?\\.\\]?\\s*\\[?\\.\\/\\/\\/?\\]?[ \\t]*/', // Some files have lines like [.] [.//]
        '/^\\[?\\.\\/\\/\\/?\\]?\\s*\\[?\\.\\]?[ \\t]*/', // Some files have lines like [.///] [.]
      ],

      prePatterns: {
        '/^\\s*<nd>\\s*$/': '\n---\n', // Some documents have this <nd> tag, which seems to be a separator of some kind
      },

      endPatterns: { // These happen before the postPatterns, because the italics get messed up by the underlined letters
        '/(\\{ *| *\\})/': '_', // In some formats, italics are signified by {braces}
        '/^>* _[^_\\n]+$/': '$&_', // Sometimes italics are not closed at the end of a blockquote line
        '/^(>* )([^_\\n]+_)$/': '$1_$2', // Sometimes italics are not opened at the beginning of a blockquote line
        '/^>* _[^_\\n]+_[^_\\n]+_[^_\\n]+$/': '$&_', // Again, sometimes italics are not closed at the end of a blockquote line
      },

      postPatterns: {
        '/\\[pg (\\d*)O([\\dO]*)]/': '[pg $10$2]', // Sometimes page numbers have capital O instaed of 0
        '/\\[pg (\\d*)O(\\d*)]/': '[pg $10$2]', // Sometimes page numbers have capital O instaed of 0...twice?
      }

    })

    this.mergeAllOptions(opts)

  }
}

TextToMarkdown.prototype._convert = function() {

  if (this.opts.correctSoftHyphens) {
    this.meta._softHyphenWords = ''
    this.correctSoftHyphens()
  }

  // Run Baha'i Autocorrect
  if (this.opts.correctBahaiWords) {
    this.correctBahaiWords()
  }

  // Handle paragraphs
  this.replaceAll(this.opts.pIndent, '', '^')
  this.replaceAll(this.opts.pIndentFirst, '\n\n', '^')

  this.replaceAll(this.opts.toLineBreaks, '\n')

  // Handle chapters, footnotes, and pages
  this.replaceAll(this.opts.chPatterns)
  this.replaceAll(this.opts.fnRefPatterns)
  this.replaceAll(this.opts.fnTextPatterns)
  this.replaceAll(this.opts.pgPatterns)

  // Handle blockquotes
  this.replaceAll(this.opts.qIndent, '$1> ', '^')
  this.replaceAll(this.opts.qIndentFirst, '\n\n> ', '^')

  // Run post-convert patterns
  this.replaceAll(this.opts.endPatterns)

  return this
}

module.exports = TextToMarkdown