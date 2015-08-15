import uriTemplates from 'uri-templates'
import inflection from 'inflection'
import { mediaType, reservedKeys, defaults,
  pageLimit, pageOffset } from './settings'
import { mapRecord, matchId, mapId, initializeContext, under } from './helpers'


// JSON API is an highly verbose and ambiguous specification. There are many
// trade-offs made in an attempt to cover everyone's use cases, such as
// resource identifier objects for polymorphic link fields, and relationship
// entities which are an entirely unnecessary complication. More importantly,
// it assumes tight coupling with the API consumer and the HTTP protocol. For
// example, it assumes that the client has *a priori* knowledge of types that
// exist on the server, since it does not define an entry point.
//
// The format is painful to implement and the specification is pretty long,
// I would not recommend doing it yourself unless you're a masochist like me.


export default Serializer => Object.assign(
class JsonApiSerializer extends Serializer {

  constructor () {
    super(...arguments)

    const { options, methods } = this

    const methodMap = {
      GET: methods.find,
      POST: methods.create,
      PATCH: methods.update,
      DELETE: methods.delete,
      OPTIONS: this.showAllow.bind(this)
    }

    // Set options.
    for (let key in defaults)
      if (!(key in options))
        options[key] = defaults[key]

    const uriTemplate = uriTemplates((options ?
      options.uriTemplate : null) || defaults.uriTemplate)

    Object.defineProperties(this, {

      // Parse the URI template.
      uriTemplate: { value: uriTemplate },

      // Default method mapping.
      methodMap: { value: methodMap },

      // Methods which may accept input.
      inputMethods: { value: new Set([ methods.create, methods.update ]) }

    })
  }


  processRequest (context) {
    // If the request was initiated without HTTP arguments, this is a no-op.
    if (arguments.length === 1) return context

    const { errors: { NotAcceptableError, UnsupportedError } } = this
    const request = arguments[1]

    // According to the spec, no accept parameters.
    if (request.headers['accept'] && ~request.headers['accept'].indexOf(';'))
      throw new NotAcceptableError(
        `Accept parameters are not allowed.`)

    // According to the spec, no content-type parameters.
    if (request.headers['content-type'] &&
    ~request.headers['content-type'].indexOf(';'))
      throw new UnsupportedError(
        `Media type parameters are not allowed.`)

    return initializeContext.call(this, context, request)
  }


  showAllow (context) {
    const { options: { allowLevel } } = this
    const { request: { uriObject } } = context

    delete uriObject.query

    const degree = Object.keys(uriObject)
      .filter(key => uriObject[key]).length

    const allow = allowLevel[degree]

    if (allow) context.response.meta['Allow'] = allow.join(', ')

    return context
  }


  // Ad-hoc entry point implementation.
  showIndex (context) {
    const { recordTypes, options, uriTemplate } = this
    const { inflectType, prefix } = options
    const output = { [reservedKeys.links]: {} }

    for (let type in recordTypes) {
      if (inflectType) type = inflection.pluralize(type)
      output[reservedKeys.links][type] = prefix +
        uriTemplate.fillFromObject({ type })
    }

    context.response.payload = output

    return context
  }


  showResponse (context, records, include) {
    const { keys, methods, uriTemplate, recordTypes,
      options: { prefix, inflectType, inflectKeys },
      errors: { NotFoundError } } = this

    if (!records)
      return this.showIndex(context)

    const { request: { method, type, ids, relatedField, relationship,
      originalType, originalIds },
      response, response: { updateModified } } = context

    if (relationship)
      return this.showRelationship(...arguments)

    // Handle a not found error.
    if (ids && ids.length && method === methods.find &&
      !relatedField && !records.length)
      throw new NotFoundError(`No records match the request.`)

    // Delete and update requests may not respond with anything.
    if (method === methods.delete ||
    (method === methods.update && !updateModified))
      return context

    const output = {}

    // Show collection.
    if (!ids && method === methods.find) {
      const { count } = records
      const { limit, offset } = context.request.options
      const collection = prefix + uriTemplate.fillFromObject({
        type: inflectType ? inflection.pluralize(type) : type
      })

      output[reservedKeys.meta] = { count }
      output[reservedKeys.links] = {
        [reservedKeys.self]: collection
      }
      output[reservedKeys.primary] = []

      // Set top-level pagination links.
      if (count > limit)
        Object.assign(output[reservedKeys.links], {
          [reservedKeys.first]: `${collection}?${pageOffset}=0` +
            `&${pageLimit}=${limit}`,
          [reservedKeys.last]: `${collection}?${pageOffset}=` +
            `${Math.floor(count / limit) * limit}&${pageLimit}=${limit}`
        },
        limit + (offset || 0) < count ? {
          [reservedKeys.next]: `${collection}?${pageOffset}=` +
            `${(Math.floor((offset || 0) / limit) + 1) * limit}` +
            `&${pageLimit}=${limit}`
        } : null,
        (offset || 0) >= limit ? {
          [reservedKeys.prev]: `${collection}?${pageOffset}=` +
            `${(Math.floor((offset || 0) / limit) - 1) * limit}` +
            `&${pageLimit}=${limit}`
        } : null)
    }

    if (records.length) {
      if (ids)
        output[reservedKeys.links] = {
          [reservedKeys.self]: prefix + uriTemplate.fillFromObject({
            type: inflectType ? inflection.pluralize(type) : type,
            ids
          })
        }

      output[reservedKeys.primary] = records.map(record =>
        mapRecord.call(this, type, record))

      if ((!originalType || (originalType &&
        !recordTypes[originalType][relatedField][keys.isArray])) &&
        ((ids && ids.length === 1) ||
        (method === methods.create && records.length === 1)))
        output[reservedKeys.primary] = output[reservedKeys.primary][0]

      if (method === methods.create)
        response.meta['Location'] = prefix +
          uriTemplate.fillFromObject({
            type: inflectType ? inflection.pluralize(type) : type,
            ids: records.map(record => record[keys.primary])
          })
    }
    else if (relatedField)
      output[reservedKeys.primary] =
    recordTypes[originalType][relatedField][keys.isArray] ? [] : null

    // Set related records.
    if (relatedField)
      output[reservedKeys.links] = {
        [reservedKeys.self]: prefix + uriTemplate.fillFromObject({
          type: inflectType ?
            inflection.pluralize(originalType) : originalType,
          ids: originalIds,
          relatedField: inflectKeys ? inflection.transform(relatedField,
            [ 'underscore', 'dasherize' ]) : relatedField
        })
      }

    // To show included records, we have to flatten them :(
    if (include) {
      output[reservedKeys.included] = []

      for (let type of Object.keys(include))
        output[reservedKeys.included].push(...include[type]
          .map(mapRecord.bind(this, type)))
    }

    if (Object.keys(output).length)
      response.payload = output

    return context
  }


  showRelationship (context, records) {
    const { method, type,
      relatedField, originalType, originalIds
    } = context.request
    const { keys, uriTemplate, recordTypes, methods,
      options: { prefix, inflectType, inflectKeys },
      errors: { BadRequestError } } = this

    if (originalIds.length > 1)
      throw new BadRequestError(
        `Can only show relationships for one record at a time.`)

    if (method !== methods.find)
      return context

    const output = {
      [reservedKeys.links]: {

        [reservedKeys.self]: prefix + uriTemplate.fillFromObject({
          type: inflectType ?
            inflection.pluralize(originalType) : originalType,
          ids: originalIds, relatedField: reservedKeys.relationships,
          relationship: inflectKeys ? inflection.transform(relatedField,
              [ 'underscore', 'dasherize' ]) : relatedField
        }),

        [reservedKeys.related]: prefix + uriTemplate.fillFromObject({
          type: inflectType ?
            inflection.pluralize(originalType) : originalType,
          ids: originalIds,
          relatedField: inflectKeys ? inflection.transform(relatedField,
            [ 'underscore', 'dasherize' ]) : relatedField
        })

      }
    }

    const isArray = recordTypes[originalType][relatedField][keys.isArray]
    const identifiers = records.map(record => ({
      [reservedKeys.type]: inflectType ?
        inflection.pluralize(type) : type,
      [reservedKeys.id]: record[keys.primary]
    }))

    output[reservedKeys.primary] = isArray ? identifiers :
      identifiers.length ? identifiers[0] : null

    context.response.payload = output

    return context
  }


  parseCreate (context) {
    const { keys, recordTypes, options, castValue,
      options: { inflectType, inflectKeys },
      errors: { MethodError, BadRequestError, ConflictError } } = this
    const { payload, relatedField, type, ids } = context.request
    const fields = recordTypes[type]

    // Can not create with IDs specified in route.
    if (ids)
      throw new MethodError(`Can not create with ID in the route.`)

    // Can not create if related records are specified.
    if (relatedField)
      throw new MethodError(`Can not create related record.`)

    let data = payload[reservedKeys.primary]

    // No bulk extension for now.
    if (Array.isArray(data))
      throw new BadRequestError(`Data must be singular.`)

    data = [ data ]

    return data.map(record => {
      const clone = {}
      const recordType = inflectType ?
        inflection.singularize(record[reservedKeys.type]) :
        record[reservedKeys.type]

      if (recordType !== type)
        throw new ConflictError(`Incorrect type.`)

      if (reservedKeys.id in record)
        clone[reservedKeys.id] = record[reservedKeys.id]

      if (reservedKeys.attributes in record)
        for (let field in record[reservedKeys.attributes]) {
          const originalField = field
          if (inflectKeys) field = inflection.camelize(under(field), true)
          clone[field] = castValue(
            record[reservedKeys.attributes][originalField],
            fields[field] ? fields[field][keys.type] : null, options)
        }

      if (reservedKeys.relationships in record)
        for (let field of Object.keys(record[reservedKeys.relationships])) {
          const originalField = field
          if (inflectKeys) field = inflection.camelize(under(field), true)

          if (!(reservedKeys.primary in
            record[reservedKeys.relationships][originalField]))
            throw new BadRequestError(`The ` +
              `"${reservedKeys.primary}" field is missing.`)

          const relatedType = inflectType ?
            inflection.pluralize(fields[field][keys.link]) :
            fields[field][keys.link]
          const relatedIsArray = fields[field][keys.isArray]
          const data = record[reservedKeys.relationships]
            [originalField][reservedKeys.primary]

          clone[field] = data ? (Array.isArray(data) ? data : [ data ])
            .map(mapId.bind(this, relatedType)) : null

          if (clone[field] && !relatedIsArray)
            clone[field] = clone[field][0]
        }

      return clone
    })
  }


  parseUpdate (context) {
    const { recordTypes, keys, options, castValue,
      options: { inflectType, inflectKeys },
      errors: { MethodError, BadRequestError, ConflictError } } = this
    const { payload, type, ids,
      relatedField, relationship
    } = context.request

    if (relationship)
      return this.updateRelationship(...arguments)

    // No related record update.
    if (relatedField) throw new MethodError(
      `Can not update related record indirectly.`)

    // Can't update collections.
    if (!Array.isArray(ids) || !ids.length)
      throw new BadRequestError(`IDs unspecified.`)

    const fields = recordTypes[type]
    const updates = []
    let data = payload[reservedKeys.primary]

    // No bulk/patch extension for now.
    if (Array.isArray(data))
      throw new BadRequestError(`Data must be singular.`)

    data = [ data ]

    for (let update of data) {
      const replace = {}
      const updateType = inflectType ?
        inflection.singularize(update[reservedKeys.type]) :
        update[reservedKeys.type]

      if (!ids.some(matchId.bind(null, update)))
        throw new ConflictError(`Invalid ID.`)

      if (updateType !== type)
        throw new ConflictError(`Incorrect type.`)

      if (reservedKeys.attributes in update)
        for (let field in update[reservedKeys.attributes]) {
          const originalField = field
          if (inflectKeys) field = inflection.camelize(under(field), true)

          replace[field] = castValue(
            update[reservedKeys.attributes][originalField],
            fields[field] ? fields[field][keys.type] : null, options)
        }

      if (reservedKeys.relationships in update)
        for (let field of Object.keys(update[reservedKeys.relationships])) {
          const originalField = field
          if (inflectKeys) field = inflection.camelize(under(field), true)

          if (!(reservedKeys.primary in
            update[reservedKeys.relationships][originalField]))
            throw new BadRequestError(`The ` +
              `"${reservedKeys.primary}" field is missing.`)

          const relatedType = inflectType ?
            inflection.pluralize(fields[field][keys.link]) :
            fields[field][keys.link]
          const relatedIsArray = fields[field][keys.isArray]
          const data = update[reservedKeys.relationships]
            [originalField][reservedKeys.primary]

          replace[field] = data ? (Array.isArray(data) ? data : [ data ])
            .map(mapId.bind(this, relatedType)) : null

          if (replace[field] && !relatedIsArray)
            replace[field] = replace[field][0]
        }

      updates.push({
        id: update[reservedKeys.id],
        replace
      })
    }

    if (updates.length < ids.length)
      throw new BadRequestError(`An update is missing.`)

    return updates
  }


  updateRelationship (context) {
    const { recordTypes, keys, methods, options: { inflectType },
      errors: { NotFoundError, MethodError,
        BadRequestError, ConflictError } } = this
    const { payload, type, relatedField,
      originalMethod, originalType, originalIds
    } = context.request
    const isArray = recordTypes[originalType][relatedField][keys.isArray]

    if (originalIds.length > 1)
      throw new NotFoundError(
        `Can only update relationships for one record at a time.`)

    if (!isArray && originalMethod)
      throw new MethodError(`Can not ` +
        originalMethod === methods.create ? 'push to' : 'pull from' +
        ` a to-one relationship.`)

    const updates = []
    const operation = originalMethod ? originalMethod === methods.create ?
      'push' : 'pull' : 'replace'
    let updateIds = payload[reservedKeys.primary]

    if (!isArray)
      if (!Array.isArray(updateIds)) updateIds = [ updateIds ]
      else throw new BadRequestError(`Data must be singular.`)

    updateIds = updateIds.map(update => {
      const updateType = inflectType ?
        inflection.singularize(update[reservedKeys.type]) :
        update[reservedKeys.type]

      if (updateType !== type)
        throw new ConflictError(`Incorrect type.`)

      if (!(reservedKeys.id in update))
        throw new BadRequestError(`ID is unspecified.`)

      return update[reservedKeys.id]
    })

    updates.push({
      id: originalIds[0],
      [operation]: {
        [relatedField]: isArray ? updateIds : updateIds[0]
      }
    })

    // Rewrite type and IDs.
    context.request.type = originalType
    context.request.ids = undefined
    return updates
  }


  showError (context, error) {
    const { errors: { MethodError } } = this
    const { name, message } = error

    if (error.constructor === MethodError)
      this.showAllow(context)

    error = Object.assign({},
      name ? { title: name } : null,
      message ? { detail: message } : null,
      error)

    context.response.payload = {
      [reservedKeys.errors]: [ error ]
    }

    return context
  }

}, { id: mediaType })
