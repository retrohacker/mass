const crypto = require('crypto')

// A determinstic digest generator that works across languages
// If we just do JSON.stringify and digest that, the digest will depend on the
// platform's implementation of JSON.stringify, which we don't want.
module.exports = (parent, stakeholders) => {
  // This character should be safe since we are creating a digest of UUID
  // values and not user generated strings.
  let str = `${parent}`
  if (stakeholders.length > 0) {
    str += '|' + stakeholders.join('|')
  }
  return crypto.createHash('sha256').update(str).digest('hex')
}
