#!/usr/bin/env node

const args = require('minimist')(process.argv.slice(2), {
  boolean: [
    'd',
    'headersCentered',
    'pageMarkersInText',
    'pNumbers',
    'r',
    's',
  ],
  string: [
    'pageMarker',
    'pageReplacement',
    'pIndent',
    'pIndentFirst',
    'qIndent',
    'qIndentFirst',
    'qBefore',
    'qAfter',
    'o',
  ],
  alias: { 
    debug: 'd',
    reconvert: 'r'
  }
})
const path = require('path')
const sh = require('shelljs')

if (args.help || args.h || args['?'] || !args._[0]) {
  console.log(`
Usage: ocean-convert [options] inputFile [inputFile...]

inputFile: file path to convert

options:
--debug, -d           show debugging information if errors occur (false)
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
--reconvert, -r       redo conversion of inputFile using metadata (false)
--outputPath, -o      path to output files
--sameFolder, -s      save output as .md file in same folder as inputFile

`)
  process.exit(0)
}

const opts = Object.assign({
  inputFiles: args._.map(f => path.resolve(process.cwd(), f)),
}, args, {['_']: null})


if (opts.d) {
  console.log(opts)
}

try {
  if (!sh.test("-f", opts.inputFile)) {
    throw new Error(`inputFile does not exist.`)
  }
  
  if (opts.outputFile !== '-' && !sh.test("-f", opts.outputFile)) {
    throw new Error (`outputFile does not exist.`)
  }
}
catch(e) {
  if (!opts.d) {
    console.error(`Error: ${e.message}`)
    process.exit(1)
  }
  throw e
}
