#!/usr/bin/env node

const TextToMarkdown = require('./text-to-markdown')
const fs = require('fs')
const path = require('path')
const sh = require('shelljs')
const args = require('minimist')(process.argv.slice(2), {
  boolean: [
    'a',
    'd',
    'D',
    'e',
    'headersCentered',
    'pageMarkersInText',
    'pNumbers',
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
--fnRefPattern
--fnRefReplacement
--fnTextPattern
--fnTextReplacement   
--headersCentered     parse centered lines as headers (true)
--pageMarker          how page markers are defined in the file, e.g. '+P{}'
--pageReplacement     replacement pattern for page markers, e.g. '<p{}>'
--pageMarkersInText   if page numbers are not on their own lines (false)
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


for (filePath of opts.inputFiles) {
  try {
    // Check if the file exists, or continue
    if (!sh.test('-f', filePath)) {
      console.error(`Error: ${filePath} does not exist, skipping...`)
    }
    // Load the file into memory
    let text = fs.readFileSync(filePath, {encoding: 'UTF-8'})
    // Create a new TextToMarkdown converter
    let doc = new TextToMarkdown(text, opts)
    // Convert the text
    doc.convert()
    // Add metadata if necessary
    doc.meta.convertedFrom = filePath
    if (opts.e) {
      Object.assign(doc.meta, extractMeta(filePath))
    }
    // Save the file
    writeFile(filePath, doc)
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
  let m = path.basename(filePath).match(/^(.+?),(.+)\.[^\.]+$/)
  if (m.length > 2) {
    return {
      author: m[1],
      title: m[2],
    }
  }
  else {
    return {
      author: path.dirname(filePath),
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
  // If this is a reconversion
  if (opts.r && path.extname(filePath) === 'md' && doc.meta.hasOwnProperty(convertedFrom)) {
    fs.writeFileSync(filePath, doc)
    return
  }
  // If we should save to --path
  else if (opts.p) {
    fs.writeFileSync(opts.p + '/' + path.basename(filePath, '.' + path.extname(filePath)) + '.md', doc)
    return
  }
  // If we should save to the default output folder owing to --outputFiles
  else if (opts.o) {
    fs.writeFileSync(opts.o + '/' + path.basename(filePath, '.' + path.extname(filePath)) + '.md', doc)
    return
  }
  // If we should save to the same folder owing to --sameFolder
  else if (opts.s) {
    fs.writeFileSync(filePath + '.md', doc)
    return
  }
  // If no file argument is selected, write to stdout
  else {
    console.log(doc)
    return
  }
  throw new Error(`Developer malfunction in function writeFile(${filePath})`)
}
