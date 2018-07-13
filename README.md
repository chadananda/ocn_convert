# Text to Markdown Converter
script to convert text files to Ocean MD

## Requirements
Node.js must run on your machine.

## Usage
There are several ways to use this script. Commands are listed in linux format but should work with windows equiavlents unless otherwise noted.

* run `node src/oceanconvert.js`
* `chmod` the src/oceanconvert.js file to be executable, then `./src/oceanconvert.js`
* run `node src/oceanconvert.js -a`, then run `oceanconvert` (only on systems with /usr/local/bin in the $PATH)

To convert a file, run `oceanconvert [options] [file]`. To convert all files in a folder, you can run `oceanconvert [options] *`, or for only text files, `oceanconvert [options] *.txt`. If you are doing this, you'll probably want the `-o` or `-p "path"` options.

Some other possible commands:
* `find . -type f ! -name '.*' -exec oceanconvert -oer {} \;`

## Ocean Markdown Metadata

Ocean Markdown files use basic YAML Front Matter (YFM) for holding metadata about each file. In order to be valid YFM, for Ocean Markdown, the following conditions must hold:

* YFM is surrounded by lines containing only `---`
* YFM occurs only at the very beginning of the file, i.e. `---` is the very first line
* YFM does not contain blank lines
* Single values consist of a field name and value separated by a colon and space, e.g.: `field: value`
* Multiple values consist of a field name, a colon, and then an indented list of values

Here is an example:

<code>
---
singleItem: This is a string.
multipleItem:
  - first
  - second
number: 0
boolean: true
---
</code>

The following fields are recognized in all Ocean Markdown files:

Field               | Type        | Req | Description
------------------- | ----------- | :-: | -----------
id                  | string      | *   | a unique string that identifies the document (auto-generated)
access              | enum        | yes | either "research", or "encumbered" for documents that cannot be scrolled.
author              | str/array   | yes | the author of the document
language            | string      | yes | the two-character language code of the document
priority            | int, 5-10   | yes | how important it is (1 = most, 10 = least)
title               | string      | yes | the title of the document, in the language of the document
titleShort          | string      | *   | a short title that won't break mobile design (required for long titles - TODO: define)
ocnmd_version       | number      | yes | the version number for the ocean markdown spec used in the file, currently 1
sourceUrl           | string      | *   | a link to the content, for display in search results (required for scraped content)
wordsCount          | int         | *   | word count of the document (auto-generated)
| | | | **Extended info:**
category            | enum        |     | the religion to which the content relates (@TODO: get category names)
coverUrl            | string      |     | url linking to the representative image
documentType        | enum        |     | a document type (@TODO: define document types)
editor              | str/array   |     | who edited the document
needsEditing        | boolean     |     | if the text quality is bad, e.g. from OCR, mark this as true
publicationName     | string      |     | the name of the publication in which this document appeared
publicationEdition  | string      |     | the edition of a book
year                | int         |     | the year that the document was written
| | | | **Primary texts and authors:**
authorAbrv          | string      |     | abbreviated author name, only for central figures
titleAbrv           | string      |     | title abbreviation, e.g. GWB for Gleanings from the Writings of Baha'u'llah
| | | | **Collection information:**
collectionTitle     | string      | *   | the title for the collection (required for items in a collection)
collectionId        | string      | *   | a unique id for the collection, comprising the collectionTitle lowercased and dashed
collectionCoverUrl  | string      |     | url linking to the image for the collection
| | | | **Language info:**
titleEn             | string      | *   | the title of the work, in English (required for books in other languages)
originalLang        | string      |     | the original language from which a translation was made
searchLang          | array       |     | an array of language codes to search for the document
translationRef      | string      |     | a string that is consistent across translations of a single document
translator          | str/array   |     | who translated the document
| | | | **Audio:**
audio               | boolean     |     | whether the item has audio
audioUrl            | str/array   |     | url(s) linking to the audio file(s)
narrator            | str/array   |     | the narrator for the audio file

This program (ocn_convert) recognizes the following additional fields:

_conversionOpts     | object      | *   | the settings used when converting the document (see oceanconvert.js)
_convertedFrom      | string      | *   | the file path or url from which the document was converted (see oceanconvert.js)

Below is a basic YFM template for new files that are being created by hand. It must go at the very beginning of the file.

```
---
author: 
title: 
titleShort:
access: 
language: en
priority: 9
ocnmd_version: 1
sourceUrl: 
category: 
coverUrl: 
documentType: 
editor: 
publicationName: 
publicationEdition: 
year: 
authorAbrv: 
titleAbrv: 
collectionTitle: 
collectionId: 
collectionCoverUrl: 
titleEn: 
originalLang: 
searchLang: 
translationRef: 
translator: 
audio: 
audioUrl: 
narrator: 
---
```

## Ocean Markdown Cheat Sheet
| Basic elements | Display |
| --- | --- |
| **Headers**
| `# Header 1` | <h1>Header 1</h1> |
| `## Header 2` | <h2>Header 2</h2> |
| `### Header 3` | <h3>Header 3</h3> |
| `#### Header 4` | <h4>Header 4</h4> |
| `##### Header 5` | <h5>Header 5</h5> |
| `###### Header 6` | <h6>Header 6</h6> |
| **Emphasis**
| `_italic text_` | _italic_ |
| `**bold text**` | **bold text** |
| `~~strikethough~~` | ~~strikethrough~~ |
| **Links**
| `[Link text](https://example.com)` | [Link text](https://example.com) |
| **Blockquotes**
| `> Blockquote text` | <blockquote>Blockquote text</blockquote> |
| `>> Nested blockquote text` | <blockquote><blockquote>nested blockquote</blockquote></blockquote> |
| `Text with block attribute.{.blockquote}` | <blockquote>Text with block attribute.</blockquote> |
| **Horizontal Rules**
| `***` or `---` or `___` | <hr> |
| `--------` or `========` | <hr class="large"> |
| **Lists**
| `* Bulleted item`<br>`- Bulleted item`<br>`+ Bulleted item` | <ul><li>Bulleted item</li><li>Bulleted item</li><li>Bulleted item</li></ul> |
| `1. Numbered item`<br>`2. Numbered item` | <ol><li>Numbered item</li><li>Numbered item</li></ol> |
| `1. Numbered item`<br>`··* nested item`<br>`··* nested item`<br>`2. Numbered item` | <ol><li>Numbered item<ul><li>nested item</li><li>nested item</li></ul></li><li>Numbered item</li></ol>
| **Fixed Width Text**
| \`\`\````Fixed width```\`\`\` | ```Fixed width``` |
| \`\`\`<br>```Fixed width```<br>\`\`\` | ```Fixed width``` |
| **Tables**
| ```| Col 1   | Col 2        | Col 3   |```<br>```| ------- | :----------: | ------: |```<br>```| left    |   centered   |   right |``` | (a table) |
| **Footnotes**
| `Footnote reference in sentence [^1].` |
| `[^1]: Footnote text` |
| **Page numbers**
| `[pg 1]` or `[pg1]` | [pg 1] or [pg1] |
| **Block attributes**
| `This is some`<br>`paragraph text.{.dropcap}` | <p><span style="font-size:20px;vertical-align:text-top;">T</span>his is some paragraph text.</p> |
| `This is some`<br>`paragraph text.{.center}` | <p style="text-align:center">This is some paragraph text.</p> |
| `This is some`<br>`paragraph text.{.right}` | <p style="text-align:right">This is some paragraph text.</p> |
| `This is`<br>`   a verse`<br>`     of poetry{.verse}` | `This is`<br>`   a verse`<br>`     of poetry` |
| `This is some`<br>`paragraph text.{.list}` | <p>This is some<br>paragraph text.</p> |

.ed: editor
.sig: signature line, e.g. on letters
.sit: exhortation or sitilcent
.noid: no paragraph number