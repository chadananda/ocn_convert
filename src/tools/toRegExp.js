module.exports = function(s, pre = '', post = '', flags = 'gm') {
  // Get regex string
  let r = s.match(/^\/([\s\S]+)\/([gim]*)$/m)
  // Get pattern and options
  let p = ''
  if (r) {
    p = r[1].replace('{*}', '(.+)')
    flags = r[2] || flags
  }
  else {
    p = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    p = p.replace('\\{\\*\\}', '(.+)')
  }
  p = pre + p + post
  return new RegExp(p, flags)
}
