const isUrl = require('is-url')
const OceanMarkdown = require('../converters/oceanMarkdown')
const fs = require('fs')
const { promisify } = require('util')
const writeFile = promisify(fs.writeFile)
const path = require('path')
const { crc16 } = require('crc')
const sh = require('shelljs')
const matter = require('gray-matter')
const tr = require('transliteration').slugify
const request = require('request')
const cachedRequest = require('cached-request')(request)
cachedRequest.setCacheDirectory(__dirname + '/../../cache')
cachedRequest.setValue('ttl', (60*60*24*30*1000))
const Sema = require('async-sema')
const s = new Sema(2)

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
  getMeta: function(filePath, fixMeta = false) {
    if (!isUrl(filePath) && sh.test('-f', filePath)) {
      let text = sh.head({'-n': 199}, filePath).toString() + "\n---\n"
      if (fixMeta) {
        text = OceanMarkdown.prototype.fixMeta(text)
      }
      if (matter.test(text)) return matter(text).data
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
      // var readOptions = {
      //   'flags': 'r', 'encoding': 'utf-8', 'mode': 0666
      //   // , 'bufferSize': 4 * 1024
      // }
      stream = fs.createReadStream(pathOrUrl, "utf8")
    }
    return stream
  },

  /**
   *
   * @param {URL} url
   */
  downloadFileName: function(url) {
    if (typeof URL === 'string') url = new URL(url)
    let urlPath = url.hostname + path.dirname(url.pathname)
    let fileName = path.basename(url.pathname)
    return `${crc16(urlPath).toString(16)}.${fileName}`
  },

  downloadImages: async function(urls, filePath) {
    if (!sh.test('-d', filePath + '/img')) sh.mkdir(filePath + '/img')
    for (url of urls) {
      let fileName = filePath + '/img/' + this.downloadFileName(url)
      try {
        if (!sh.test('-f', fileName)) {
          console.log(`Downloading image: ${fileName}`)
          await new Promise(resolve =>
            request(url.toString())
              .pipe(fs.createWriteStream(fileName))
              .on('finish', resolve))
        }
      }
      catch(e) {
        console.error(`Error downloading image: ${fileName}\n${e.stack}`)
      }
    }
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
      if (typeof doc === 'object' && doc.opts.downloadImages && doc.images.length) {
        await this.downloadImages(doc.images, path.dirname(filePath))
      }
      await writeFile(filePath, doc)
      console.log(`Wrote "${filePath}"`)
    }
    else {
      console.log(doc.toString())
    }
    return true
  },

  urlToFilename: function(url) {
    return tr(url.toString().replace(/^(https?)?\/*/, '')) + '.md'
  },

}
