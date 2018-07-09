const OceanMarkdown = require('./oceanmarkdown')

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
  constructor(input, opts = {}, meta = {}, raw = '') {

    // Fix single-entry patterns from parameters before building object
    for (let x of ['ch', 'fnRef', 'fnText', 'pg']) {
      if (opts[x + 'Pattern'] && opts[x + 'Replacement']) {
        opts[x + 'Patterns'][opts[x + 'Pattern']] = opts[x + 'Replacement']
        opts[x + 'Pattern'] = ''
      }
    }

    super(input, opts, meta, raw)

    this.addDefaultConversionOpts({

      // Chapters
      chPatterns: {},
      chPattern: '',
      chReplacement: '## $1',
    
      // Footnotes
      fnRefPatterns: {
        '[{fn}](\s)': '[^$1]$2',
        '+F{fn}': '[^$1]'
      },
      fnRefPattern: '',
      fnRefReplacement: '[^$1]',
      fnTextPattern: {
        '/^\\[{fn}\\.? {*}\\]/': '[$1]: $2',
        '/^([0-9]+). \\[{*}\\]$/': '[$1]: $2',
        '/^\\.{10} ?\\[{fn}\\.? {*}\\]/': '[$1]: $2',
      },
      fnTextPattern: '',
      fnTextReplacement: '[$1]: $2',
    
      // Headers
      headersCentered: false,
    
      // Page Numbers
      pgPatterns: {
        '|PPage_{pg}': '[pg $1]',
        '<p{pg}>': '[pg $1]',
        '+P{pg}': '[pg $1]',
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
    
      postPatterns: {
        '/(\\{ *| *\\})/': '_', // In some formats, italics are signified by {braces}
        '/^>* _[^_\\n]+$/': '$&_', // Sometimes italics are not closed at the end of a blockquote line
        '/^(>* )([^_\\n]+_)$/': '$1_$2', // Sometimes italics are not opened at the beginning of a blockquote line
        '/^>* _[^_\\n]+_[^_\\n]+_[^_\\n]+$/': '$&_', // Again, sometimes italics are not closed at the end of a blockquote line
        '/^<nd>$/': '---', // Some documents have this <nd> tag, which seems to be a separator of some kind
      }
    
    })

    // Get full list of options for conversion
    this.opts = this.mergeOptions(this.defaultConversionOpts, opts)
    this.meta._conversionOpts = this.mergeOptions(this.meta._conversionOpts, opts)

  }
}

TextToMarkdown.prototype.convert = function() {
  if (this.opts.skip) {
    this.content = ''
    return
  }

  this.content = this.raw

  // Basic cleanup
  this.cleanupText().replaceAll(this.opts.prePatterns)

  if (this.opts.correctSoftHyphens) {
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
  this
    .replaceAll(this.opts.chPatterns)
    .replaceAll(this.opts.fnRefPatterns)
    .replaceAll(this.opts.fnTextPatterns)
    .replaceAll(this.opts.pgPatterns)

  // Handle blockquotes
  this.replaceAll(this.opts.qIndent, '$1> ', '^')
  this.replaceAll(this.opts.qIndentFirst, '\n\n> ', '^')

  // Run post-convert patterns
  this.replaceAll(this.opts.postPatterns)

  return this
}

module.exports = TextToMarkdown