var cheerio = require('cheerio'),
	url = require('url');

function Document(url, res) {
	this.url = url;
	this.res = res;
	this.body = this.res.body
}

Document.prototype = {
	constructor: Document,

	// Lazy parse
	get $() {
		return this._$ || (this._$ = cheerio.load(this.body));
	},

	resolve: function(uri) {
		return url.resolve(this.url, uri);
	}
};

module.exports = Document;