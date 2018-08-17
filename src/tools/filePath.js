const isUrl = require('is-url')
const fs = require('fs')
const { promisify } = require('util')
const writeFile = promisify(fs.writeFile)
const path = require('path')
const sh = require('shelljs')
const matter = require('gray-matter')

module.exports = {
  isUrl: isUrl,

  resolve: function(filePathOrUrl) {
    if (/[\f\r\n]/.test(filePathOrUrl) || filePathOrUrl.length > 1024) return false
    if (isUrl(filePathOrUrl)) return filePathOrUrl
    return path.resolve(process.cwd(), filePathOrUrl)
  },

  /**
   * Retrieves metadata from the yaml front matter of an .md doc
   * 
   * @param {string} filePath
   * the file path from which to retrieve the metadata
   */
  getMeta: function(filePath) {
    if (!isUrl(filePath) && sh.test('-f', filePath)) {
      return matter(sh.head({'-n': 99}, filePath).toString() + "\n---\n").data
    }
    return {}
  },

  extractMetaFromName: function(filePath) {
    let m = path.basename(filePath).match(/^(.+?)\s*,\s*(.+)\.[^\.]+$/)
    if (m && m.length > 2) {
      return {
        author: m[1],
        title: m[2],
      }
    }
    else {
      return {
        author: path.dirname(filePath).split('/').pop(),
        title: path.basename(filePath, path.extname(filePath)),
      }
    }
  },

  loadUrl: async function(url, encoding = null) {
    const request = require('request')
    const cachedRequest = require('cached-request')(request)
    cachedRequest.setCacheDirectory('./cache')
    cachedRequest.setValue('ttl', (60*60*24*30))

    // Set the encoding for the request, unless it is specifically set to 0 || false
    if (encoding || (encoding === null)) {
      cachedRequest.setValue('encoding', encoding)
    }

    let stream = await cachedRequest({url: url})

    return stream
  },

  load: async function(pathOrUrl) {
    let stream

    if (isUrl(pathOrUrl)) {
      // Load the url using a request
      stream = await this.loadUrl(pathOrUrl)
      return stream
    }
    else {
      filePath = path.resolve(process.cwd(), pathOrUrl)
  
      // Check if filePath exists
      if (!sh.test('-f', pathOrUrl)) {
        return false
      }
    
      // Load the file into a stream
      stream = fs.createReadStream(pathOrUrl)

    }
    return stream
  },

  /**
   * Outputs a file to disk or stdout
   * @param {string} filePath
   * The full path of the file to write
   * @param {TextToMarkdown} doc
   * The converted object to write to the file 
   */
  writeFile: async function(filePath, doc) {
    if (filePath && filePath !== '-') {
      await writeFile(filePath, doc)
      console.log(`Wrote "${filePath}"`)
    }
    else {
      console.log(doc.toString())
    }
    return true
  },

}
