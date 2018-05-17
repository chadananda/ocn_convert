# Text to Markdown Converter
script to convert text files to Ocean MD

## Ocean Markdown Cheat Sheet
| Basic elements | Display |
| --- | --: |
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
| `Paragraph text.{.dropcap}` | <p>Paragraph text.</p> |
| `Paragraph text.{.center}` | Paragraph text.{.center} |
| `Paragraph text.{.right}` | Paragraph text.{.right} |

.dropcap:
.blockquote:
.center:
.right:

.verse: respects all whitespace
.list: respects line breaks

.ed: editor
.sig: signature line, e.g. on letters
.sit: exhortation or sitilcent
.noid: no paragraph number