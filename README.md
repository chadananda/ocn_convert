# Text to Markdown Converter
script to convert text files to Ocean MD

## Include option to correct common Baha'i words using code from ocntools:
https://github.com/chadananda/ocntools

## Ocean Markdown Cheat Sheet
| Text | Display |
| --- | --: |
| **Headers**
| `# Header 1` |
| `## Header 2` |
| `### Header 3` |
| `#### Header 4` |
| `##### Header 5` |
| `###### Header 6` |
| `# Header not shown in TOC {.title}` |
| `# Header with different TOC {toc="Diff"}`
| `# Header not shown in TOC {.notoc}` |
| **Emphasis**
| `_italic text_` | _italic_ |
| `**bold text**` | **bold text** |
| **Links**
| `[Link text](https://example.com)` | [Link text](https://example.com) |
| **Blockquotes**
| `> Blockquote text` |
| `>> Nested blockquote text` |
| **Horizontal Rules**
| `***` or `---` or `___`
| **Lists**
| `* Bulleted item`<br>`- Bulleted item`<br>`+ Bulleted item` |
| `1. Numbered item`<br>`2. Numbered item` |
| `1. Numbered item`<br>`··* nested item`<br>`··* nested item`<br>`2. Numbered item` |
| **Fixed Width Text**
| \`\`\````Fixed width```\`\`\` | ```Fixed width``` |
| **Tables**
| `| Col 1   | Col 2        | Col 3   |`<br>`| ------- | :----------: | ------: |`<br>`| left    |   centered   |   right |` |
| **Footnotes**
| `Footnote reference in sentence [^1].` |
| `[^1]: Footnote text` |
| **Page numbers**
| | |
| **Paragraph numbers**
| | |
