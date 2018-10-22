#!/usr/bin/env node

const ver=0.2
const fp = require('./tools/filePath')
const path = require('path')
const sh = require('shelljs')
const converters = require('./index')
const Sema = require('async-sema')
const s = new Sema(4)
const { URL } = require('url')
const args = require('minimist')(process.argv.slice(2), {
  boolean: [
    'a',
    'd',
    'D',
    'e',
    'o',
    'r',
    's',
    'b',
    'B',
    'v',
    'R',
    'M',
    'fixMeta',
  ],
  string: [
    'converter',
    'c',
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
    'path',
    'fromEncoding',
    'E',
  ],
  alias: {
    fixMeta: 'fixmeta',
    verbose: 'v',
    bahai: 'b',
    noBahai: 'B',
    addLink: 'a',
    debug: 'd',
    debugOnly: 'D',
    extractMeta: 'e',
    outputFiles: 'o',
    path: 'p',
    sameFolder: 's',
    fromEncoding: 'E',
    noReconvert: 'R',
    checkMeta: 'M',
    converter: 'c',
  }
})

function camelize(str) {
  return str.replace(/(?:^\w|[A-Z]|\b\w)/g, function(letter, index) {
    return index == 0 ? letter.toLowerCase() : letter.toUpperCase();
  }).replace(/[\W_]+/g, '');
}

if (args.version) {
  console.log(ver)
  process.exit(0)
}

if (args.D) {
  console.log(`OceanConvert version ${ver}`)
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
Usage: ocean-convert [options] pathOrUrl [pathOrUrl...]

inputFile: file path to convert

General options:
--addLink, -a         add a symlink to your /usr/local/bin directory
--converter, -c       the name of the converter to use, e.g. text or html
                      (may be the name of a custom converter, e.g. wikipedia)
--debug, -d           show debugging information if errors occur (false)
--debugOnly, -D       just show the debugging info and exit
--extractMeta, -e     extract metadata from the filename, in the format
                      {author},{title}.ext or {author}/{title}.ext
--fromEncoding, -E    convert to utf-8 from a specific encoding (override)
--checkMeta, -M       check metadata for an already converted file
                      (creates id and word count, and updates old fields)
--fixMeta             attempt to fix metadata from a broken file
--verbose, -v         output debug info to terminal

Conversion options:
--bahai, -b           correct Bahá'í words (default) - use to override previous
                      -B option recorded in .md output meta
--noBahai, -B         skip correcting Bahá'í words
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
--reconvert, -r       redo conversion of inputFile using metadata (true)
--noReconvert, -R    do NOT re-convert the file on future passes
--sameFolder, -s      save output as .md file in same folder as inputFile

`)
  process.exit(0)
}

const opts = Object.assign({
  inputFiles: args._.map(f => (fp.isUrl(f) ? f : path.resolve(process.cwd(), f))),
}, args, {_: null})

// Assign some variables here
if (opts.fixMeta || opts.M) { opts.M = true; opts.r = true; }
if (opts.o) opts.o = path.resolve(__dirname + '/../output')
if (opts.p) opts.p = path.resolve(process.cwd(), opts.p)
if (opts.b || opts.B) opts.correctBahaiWords = opts.b || !opts.B
if (opts.r || opts.R) opts.reconvert = opts.r || !opts.R
else if (opts.reconvert) opts.reconvert = true

if (args.v) {
  console.log(opts)
}

// TODO: basic error checking here
if (opts.o && !sh.test('-e', opts.o)) {
  sh.mkdir(opts.o)
}

if (opts.spider) {
  for (filePath of opts.inputFiles) {
    _spider(filePath, Object.assign({}, opts))
  }
}
else {
  for (filePath of opts.inputFiles) {
    _process(filePath, Object.assign({}, opts))
  }  
}

async function _spider(filePath, fileOpts) {
  await s.acquire()
  try {
    let spiderName = (typeof opts.spider === 'string' ? './spiders/custom/' + opts.spider : './spiders')
    let Spider = require(spiderName)
    let spider = new Spider(filePath, fileOpts)
    spider.queue(filePath, spider._process)
  }
  catch (e) {
    if (fileOpts.d) {
      throw e
    }
    process.exitCode = 1
    console.error(`Error spidering ${filePath}: ${e.message}`)
  }
  s.release()
}

async function _process(filePath, fileOpts) {
  if (filePath.match(/\/readme\.md$/i)) return
  await s.acquire()
  try {
    // Check if filePath exists, or continue
    if (!fp.isUrl(filePath) && !sh.test('-f', filePath)) {
      console.error(`${filePath} is not a file or url, skipping...`)
      return false
    }

    // Add metadata if necessary
    if (fileOpts.e) {
      Object.assign(fileOpts, fp.extractMetaFromName(filePath))
    }

    // Get the path of the original file
    let writeFilePath = _writeFilePath(filePath, fileOpts)

    // If we are reconverting an existing .md file, get the metadata from that file
    if (writeFilePath !== '-' && sh.test('-f', writeFilePath)) {
      let savedMeta = fp.getMeta(writeFilePath, fileOpts.fixMeta || false)
      Object.assign(fileOpts, savedMeta || {}, savedMeta._conversionOpts || {})
    }

    // If we are fixing metadata, just use the writeFilePath
    if (opts.M) {
      filePath = writeFilePath
    }

    // Otherwise, and if reconvert was called on the .md file itself, 
    // then use the _convertedFrom metadata to get the original data
    else if ((filePath === writeFilePath) && fileOpts._convertedFrom) {
      filePath = fileOpts._convertedFrom
    }
    
    // If we are converting a new file, add _convertedFrom
    if (filePath !== writeFilePath && !fileOpts._convertedFrom) {
      fileOpts._convertedFrom = filePath
    }

    // For URLs, get the converter based on the site name
    if (!fileOpts.converter && !fileOpts.c) {
      let ext = path.extname(filePath).replace('.', '')
      if (fp.isUrl(filePath) && (!ext || /^x?htm/.test(ext))) {
        let htmlType = camelize(new URL(filePath).hostname.replace(/^www\./, '')) || 'html'
        fileOpts.converter = (converters.converters.hasOwnProperty(htmlType) ? htmlType : 'html') // should be saved in _conversionOpts
      }
      else if (converters.converters.hasOwnProperty(ext)) fileOpts.c = ext // should NOT be saved in _conversionOpts
      else fileOpts.c = 'text' // should NOT be saved in _conversionOpts
    }

    // Load the file and perform the actual conversion
    let stream = await fp.load(filePath)
    let doc = await converters.getConverter(fileOpts.converter || fileOpts.c, stream, fileOpts)

    if (fileOpts.M) {
      doc.checkMeta()
      if (doc.rawStream !== doc.toString()) {
        sh.cp(writeFilePath, `${writeFilePath}.bak`)
      }
    }
    else {
      doc.convert()
    }

    if (doc.metaErrors.length) {
      process.exitCode = 1
      console.error(`${filePath} has bad/missing metadata (${doc.metaErrors.join(', ')})`)
    }

    await fp.writeFile(writeFilePath, doc)

    // Save debugging info
    if (fileOpts.d) {
      Object.keys(doc.debugInfo).forEach(async (k) => {
        if (doc.debugInfo[k].length) {
          await fp.writeFile(`${writeFilePath}.${k}.debug`, (typeof(doc.debugInfo[k]) === 'string' ? doc.debugInfo[k] : doc.debugInfo[k].join('\n')) + '\n')
        }
      })
    }
    
  }
  catch (e) {
    if (fileOpts.d) {
      throw e
    }
    process.exitCode = 1
    console.error(`Error converting ${filePath}:\n - ${(fileOpts.d ? e.stack : e.message)}`)
  }
  s.release()
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
  let fileName
  
  // Create good filenames for external urls
  if (fp.isUrl(filePath)) {
    fileName = fp.urlToFilename(filePath)
  }
  // If we are extracting title data, save the file as Author, Title.md 
  else if (opts.e && (meta.author || false) && (meta.title || false)) {
    fileName = meta.author.trim() + ', ' + meta.title.trim() + '.md'
  }
  // Otherwise, just use the original filename
  else {
    fileName = path.basename(filePath, path.extname(filePath)) + '.md'
  }

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
