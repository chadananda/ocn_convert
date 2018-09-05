const Parent = require('./htmlToMarkdown')

class htmlPreToMarkdown extends Parent {
  constructor (input, opts) {
    super(input, opts)
    this.addDefaultConversionOpts({
      contentElement: 'body pre'
    })
  }
}

module.exports = htmlPreToMarkdown