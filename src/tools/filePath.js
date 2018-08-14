const isUrl = require('is-url')
const fs = require('fs')
const path = require('path')
const sh = require('shelljs')
const matter = require('gray-matter')
const { promisify } = require ('util')
const readFile = promisify(fs.readFile)
const chardet = require('chardet')
const iconv = require('iconv-lite')

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
    const cachedRequest = require('cached-request')(request).setValue('ttl', (60*60*24*30))

    // Set the encoding for the request, unless it is specifically set to 0 || false
    if (encoding || (encoding === null)) {
      cachedRequest.setValue('encoding', encoding)
    }

    let doc = await cachedRequest({url: url}, (err, res, _) => {
      if (err) {
        throw err
      }
      doc = _
    })

    return doc._
  },

  loadFile: async function(filePath, encoding = null) {
    let fileBuffer

    if (isUrl(filePath)) {
      fileBuffer = await this.loadUrl(filePath, encoding)
    }
    else {
      filePath = path.resolve(process.cwd(), filePath)
  
      // Check if filePath exists
      if (!sh.test('-f', filePath)) {
        return false
      }
    
      // Load the file into a buffer
      fileBuffer = await readFile(filePath)

      // For .md files, just use UTF-8
      if ((!encoding || encoding === null) && /\.md$/.test(filePath)) {
        return {
          encoding: encoding,
          content: iconv.decode(fileBuffer, 'UTF-8')
        }
      }
    }
  
    // If no encoding is specified, try to detect it
    if (!encoding || encoding === null) {
      encoding = chardet.detect(fileBuffer)
    }
  
    return {
      encoding: encoding,
      content: iconv.decode(fileBuffer, encoding)
    }
  },

  /**
   * Outputs a file to disk or stdout
   * @param {string} filePath
   * The full path of the file to write
   * @param {TextToMarkdown} doc
   * The converted object to write to the file 
   */
  writeFile: function(filePath, doc) {
    if (filePath && filePath !== '-') {
      fs.writeFileSync(filePath, doc)
      console.log(`Wrote "${filePath}"`)
    }
    else {
      console.log(doc.toString())
    }
  },

}
