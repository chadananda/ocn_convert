#!/usr/bin/env node

const TextToMarkdown = require('./text-to-markdown')
const fs = require('fs')
const path = require('path')
const sh = require('shelljs')
const matter = require('gray-matter')
const args = require('minimist')(process.argv.slice(2), {
  boolean: [
    'a',
    'd',
    'D',
    'e',
    'o',
    'r',
    's',
  ],
  string: [
    'fnRefPattern',
    'fnRefReplacement',
    'fnTextPattern',
    'fnTextReplacement',
    'pageMarker',
    'pageReplacement',
    'pIndent',
    'pIndentFirst',
    'qIndent',
    'qIndentFirst',
    'qBefore',
    'qAfter',
    'p',
  ],
  alias: { 
    addLink: 'a',
    debug: 'd',
    debugOnly: 'D',
    extractMeta: 'e',
    outputFiles: 'o',
    path: 'p',
    reconvert: 'r',
    sameFolder: 's',
  }
})

if (args.D) {
  console.log(Object.assign({inputFiles: args._}, args, {_: null}))
  process.exit(0)
}

if (args.a) {
  try {
    sh.ln('-s', __filename, '/usr/local/bin/oceanconvert')
    console.log('The oceanconvert script is now linked.')
    process.exit(0)
  }
  catch(e) {
    console.error(e.message)
    process.exit(1)
  }
}

if (args.help || args.h || args['?'] || !args._[0]) {
  console.log(`
Usage: ocean-convert [options] inputFile [inputFile...]

inputFile: file path to convert

General options:
--addLink, -a         add a symlink to your /usr/local/bin directory
--debug, -d           show debugging information if errors occur (false)
--debugOnly, -D       just show the debugging info and exit
--extractMeta, -e     extract metadata from the filename, in the format
                      {author},{title}.ext or {author}/{title}.ext

Conversion options:
--chPattern           pattern for chapter headers
--chReplacement       replacement for chapter headers
--fnRefPattern        pattern for footnote references, e.g. '[{fn}]'
--fnRefReplacement    replacement for footnote references ('[^$1]')
--fnTextPattern       pattern for footnote text 
--fnTextReplacement   
--headersCentered     parse centered lines as headers (false)
--pgNumberFrom        number of the first page in the document
--pgPattern           how page markers are defined in the file, e.g. '+P{pg}'
--pgReplacement       replacement pattern for page markers, e.g. '[pg $1]'
--pgInText            if page numbers are not on their own lines (false)
--pIndent             string at start of every line of every paragraph
--pIndentFirst        string at start of first line of paragraph (1-4 spaces)
--pNumbers            if paragraphs begin with the paragraph number (false)
--qIndent             string at start of every line of a quote (1-4 spaces)
--qIndentFirst        string at start of first line of a quote (5-8 spaces)
--qBefore             string before a quote
--qAfter              string after a quote

Output options:
--outputFiles, -o     output files to ocn_convert/output
--path, -p            output files to path
--reconvert, -r       redo conversion of inputFile using metadata (false)
--sameFolder, -s      save output as .md file in same folder as inputFile

`)
  process.exit(0)
}

const opts = Object.assign({
  inputFiles: args._.map(f => path.resolve(process.cwd(), f)),
}, args, {_: null})

// Assign some variables here
if (opts.o) opts.o = path.resolve(__dirname + '/../output')
if (opts.p) opts.p = path.resolve(process.dirname, opts.p)

if (args.d) {
  console.log(opts)
}

// TODO: basic error checking here
if (!sh.test('-e', opts.o)) {
  sh.mkdir(opts.o)
}


for (filePath of opts.inputFiles) {
  try {

    // Check if filePath exists, or continue
    if (!sh.test('-f', filePath)) {
      console.error(`Error: ${filePath} does not exist, skipping...`)
    }
    
    let meta = {}
    // Add metadata if necessary
    if (opts.e) {
      Object.assign(meta, extractMeta(filePath))
    }

    // Get the path of the original file
    let writeFilePath = _writeFilePath(filePath, meta)
    
    if (writeFilePath != filePath) {
      meta.convertedFrom = filePath
    }

    // If we are reconverting...
    if (opts.r && writeFilePath !== '-') {
      // ...get the metadata from the saved file
      meta = Object.assign(_getMeta(writeFilePath), meta)
      // ...and if necessary, get the original file to read from
      if (writeFilePath === filePath && meta.hasOwnProperty('convertedFrom')) {
        if (!sh.test('-f', meta.convertedFrom)) {
          console.error(`Error: "${meta.convertedFrom}" does not exist on your system, and you have requested to reconvert it. You can either:
          1. change the "convertedFrom" metadata in "${filePath}", or
          2. go to the folder where the document is and convert it again with this option:
          -p "${path.dirname(filePath)}"`)
          continue
        }
        filePath = meta.convertedFrom
      }
    }
    
    // Create a new TextToMarkdown converter
    let doc = new TextToMarkdown(fs.readFileSync(filePath, {encoding: 'UTF-8'}), opts, meta)

    // Convert the text
    doc.convert()

    // Save the file
    writeFile(writeFilePath, doc)
    doc = null
  }
  catch(e) {
    if (!opts.d) {
      console.error(`Error converting ${filePath}: ${e.message}`)
    }
    else {
      throw e
    }
  }
}

function extractMeta(filePath) {
  let m = path.basename(filePath).match(/^(.+?)\s?,\s?(.+)\.[^\.]+$/)
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
}

/**
 * Outputs a file to disk or stdout
 * @param {string} filePath
 * The full path of the file to write
 * @param {TextToMarkdown} doc
 * The converted object to write to the file 
 */
function writeFile(filePath, doc) {
  if (filePath) {
    fs.writeFileSync(filePath, doc)
    console.log(`Converted "${filePath}"`)
  }
  else {
    console.log(doc.toString())
  }
}

/**
 * Retrieves metadata from the yaml front matter of an .md doc
 * 
 * @param {string} filePath 
 * the file path from which to retrieve the metadata
 */
function _getMeta(filePath) {
  return (sh.test('-f', filePath) ? matter(sh.head({'-n': 50}, filePath).toString() + "\n---").data : {})
}

/**
 * Return that path to write data for a conversion
 * 
 * @param {string} filePath 
 * the file being converted
 * 
 * @param {object} meta 
 * the metadata for the file being converted
 */
function _writeFilePath(filePath, meta = {}) {
  // If we are extracting title data, save the file as Author, Title.md
  fileName = (
    (opts.e && (meta.author || false) && (meta.title || false)) ? 
    meta.author.trim() + ', ' + meta.title.trim() + '.md' : 
    path.basename(filePath, path.extname(filePath)) + '.md'
  )
  // If this is a reconversion
  if (opts.r && path.extname(filePath) === '.md') {
    return filePath
  }
  // If we should save to --path
  else if (opts.p) {
    return opts.p + '/' + fileName
  }
  // If we should save to the default output folder owing to --outputFiles
  else if (opts.o) {
    return opts.o + '/' + fileName
  }
  // If we should save to the same folder owing to --sameFolder
  else if (opts.s) {
    return filePath + '.md'
  }
  // If no file argument is selected, write to stdout
  return '-'
}
