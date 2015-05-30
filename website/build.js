import fs from 'fs'
import path from 'path'
import docchi from 'docchi'
import myth from 'myth'
import mustache from 'mustache'
import marked from 'marked'
import mkdirp from 'mkdirp'
import hjs from 'highlight.js'
import inflection from 'inflection'
import { minify } from 'html-minifier'


const pkg = require('../package.json')
const start = Date.now()
const year = new Date().getFullYear()


// Declarations
// ============

const CNAME = 'fortunejs.com'

const outputPath = path.join(__dirname, '../dist/web')
const assetPath = path.join(__dirname, 'assets')
const apiPath = path.join(__dirname, '../lib')
const templatePath = path.join(__dirname, 'templates')
const docPath = path.join(__dirname, '../doc')
const stylesheetPath = path.join(__dirname, 'stylesheets')

const templates = {}
const docs = {}
const api = [
  { module: 'Fortune', path: 'index.js' },
  { module: 'Adapter', path: 'adapter/index.js' },
  { module: 'Serializer', path: 'serializer/index.js' },
  { module: 'Dispatcher', path: 'dispatcher/index.js' },
  { module: 'Net', path: 'net/http.js' }
]

const renderer = new marked.Renderer()

renderer.heading = (text, level) => {
  const escapedText = text.toLowerCase().replace(/[^\w]+/g, '-')

  return `<h${level} id="${escapedText}">${text}<a class="anchor" ` +
    `href="#${escapedText}" title="Link to this section “${text}”">#</a>` +
    `</h${level}>`
}

const markedOptions = {
  renderer, highlight: code => hjs.highlightAuto(code).value
}

const minifyOptions = { collapseWhitespace: true }


// Initialization
// ==============

function setFlags (ns, obj) {
  const { type } = obj.context

  if (ns === obj.context.name) {
    obj.context.anchor = ns.toLowerCase()
    obj.context.path = ns
  }
  else {
    obj.context.anchor = (`${ns}-${obj.context.name}`).toLowerCase()
    obj.context.path = `${ns}.<span class="key">${obj.context.name}</span>`
  }

  if (type === 'property')
    obj.context.isProperty = true

  if (type === 'method' || type === 'function' || type === 'constructor')
    obj.context.isFunction = true

  const getName = element => element.name || 'any type'
  const params = []

  for (let tag of obj.comment.tags) {
    if (tag.title === 'return') {
      obj.comment.returnType = tag.type.name
      if (tag.type.elements) obj.comment.returnType =
        tag.type.elements.map(getName).join(' | ')
      continue
    }
    if (tag.title === 'param') {
      let name = tag.name
      let type = tag.type.name
      const description = tag.description
      const isOptional = tag.type.type === 'OptionalType'
      const isArray = tag.type.expression &&
        (tag.type.expression.expression || tag.type.expression)
        .name === 'Array'
      const isRest = tag.type.expression &&
        tag.type.expression.type === 'RestType'

      if (isOptional)
        type = tag.type.expression.name

      if (isArray)
        type = 'Array of ' + inflection.pluralize(
          (tag.type.expression.applications || tag.type.applications)
          .map(getName).map(inflection.pluralize.bind(inflection)).join(', '))

      if (isRest) {
        type = `Arbitrary number of ` + getName(
          tag.type.expression.expression || tag.type.expression)
        name = `&hellip;${name}`
      }

      params.push(`<span class="parameter" title="${type}` + (description ?
        `. ${description}` : '') + `">` +
        (isOptional ? `[${name}]` : name) + '</span>')
    }
  }

  if (params.length) obj.comment.params = params.join(', ')

  return obj
}

const render = description => marked(description, markedOptions)

for (let container of api)
  container.docs = docchi.parse(fs.readFileSync(
    path.join(apiPath, container.path))).output({ render })
    .map(setFlags.bind(null, container.module))

for (let file of fs.readdirSync(templatePath))
  templates[path.basename(file, '.mustache')] =
    fs.readFileSync(path.join(templatePath, file)).toString()

for (let file of fs.readdirSync(docPath)) {
  const basename = path.basename(file, '.md')

  docs[basename.toLowerCase()] = {
    root: '../',
    title: inflection.titleize(basename),
    year, api,
    content: marked(
      fs.readFileSync(path.join(docPath, file)).toString(), markedOptions)
  }
}

(() => {
  const readme = fs.readFileSync(
    path.join(__dirname, '..', 'README.md')).toString()

  const example = (/(## Example([\s\S]+)(?=\n#))/g).exec(readme)[2]

  docs.readme = {
    root: './',
    title: 'Fortune.js',
    year, api,
    description: pkg.description,
    keywords: pkg.keywords.join(','),
    content: mustache.render(templates.home, { version: pkg.version }) +
      marked(example, markedOptions)
  }
})()


// Copy assets
// ===========

mkdirp.sync(path.join(outputPath, 'assets'))
for (let file of fs.readdirSync(assetPath))
  fs.createReadStream(path.join(assetPath, file))
  .pipe(fs.createWriteStream(path.join(
    outputPath, 'assets', path.basename(file))))


// Build stylesheets
// =================

; (() => {
  const inputFile = path.join(stylesheetPath, 'style.css')

  fs.writeFileSync(path.join(outputPath, 'assets/style.css'),
    myth(fs.readFileSync(inputFile).toString(), {
      compress: true,
      source: path.join(stylesheetPath, 'style.css')
    }))
})()


// Build the pages
// ===============

fs.writeFileSync(path.join(outputPath, 'index.html'), minify(
  mustache.render(templates.page, docs.readme, templates), minifyOptions))

mkdirp.sync(path.join(outputPath, 'api'))
fs.writeFileSync(path.join(outputPath, 'api/index.html'), minify(
  mustache.render(templates.page, {
    root: '../',
    title: 'API Reference',
    year, api,
    content: mustache.render(templates.api, api)
  }, templates), minifyOptions))

for (let doc in docs) {
  mkdirp.sync(path.join(outputPath, doc))
  fs.writeFileSync(path.join(outputPath, doc, 'index.html'), minify(
    mustache.render(templates.page, docs[doc], templates), minifyOptions))
}


// Write CNAME file
// ================

fs.writeFileSync(path.join(outputPath, 'CNAME'), CNAME)


// End
// ===

process.stderr.write(`Done! Build finished in ` +
  `${(Date.now() - start) / 1000} s.\n`)
