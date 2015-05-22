import { inBrackets, isField, isMatch } from './settings'


export function attachQueries (context, query, options) {
  const { request } = context
  const { queries, includeDepth, pageLimit } = options

  // Iterate over dynamic query strings.
  Object.keys(query).forEach(parameter => {

    // Attach fields option.
    if (parameter.match(isField)) {
      const sparseField = query[parameter]
      const sparseType = (parameter.match(inBrackets) || [])[1]
      const fields = (Array.isArray(sparseField) ?
        sparseField : [sparseField]).reduce((fields, field) => {
          fields[field] = true
          return fields
        }, {})

      if (sparseType === request.type)
        request.options.fields = fields
      else if (sparseType) {
        if (!(sparseType in request.includeOptions))
          request.includeOptions[sparseType] = {}

        request.includeOptions[sparseType].fields = fields
      }
    }

    // Attach match option.
    if (parameter.match(isMatch)) {
      if (!request.options.match) request.options.match = {}
      const field = (parameter.match(inBrackets) || [])[1]
      request.options.match[field] = query[parameter]
    }

  })

  // Attach sort option.
  if (queries.has('sort') && query.sort) {
    let sort = query.sort
    if (!Array.isArray(sort)) sort = [sort]

    request.options.sort = sort.reduce((sort, field) => {
      const firstChar = field.charAt(0)

      sort[field.slice(1)] = firstChar === '+' ? 1 : -1

      return sort
    }, {})
  }

  // Attach include option.
  if (queries.has('include') && query.include)
    request.include = query.include
      .split(',').map(i => i.split('.')
      .slice(0, includeDepth))

  // Attach offset option.
  if (queries.has('offset') && query.offset)
    request.options.offset =
      Math.abs(parseInt(query.offset, 10))

  // Attach default limit.
  if (queries.has('limit') && query.limit) {
    const limit = Math.abs(parseInt(query.limit, 10))
    request.options.limit =
      limit > pageLimit ? pageLimit : limit
  }
  else request.options.limit = pageLimit
}
