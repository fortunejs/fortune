import { primary as primaryKey, link as linkKey } from '../common/keys'
import { find } from '../common/array_proxy'


/**
 * Fetch included records. This mutates `context`.response`
 * for the next method.
 *
 * @return {Promise}
 */
export default function (context) {
  const {
    request: { type, ids, include, meta },
    response: { records }
  } = context

  if (!type || !include || !records) return context

  const { recordTypes, adapter } = this

  // This cache is used to keep unique IDs per type.
  const idCache = {
    [type]: new Set(ids)
  }

  // It's necessary to iterate over primary records if no IDs were
  // provided initially.
  if (ids && !ids.length)
    for (let record of records)
      idCache[type].add(record[primaryKey])

  return Promise.all(include.map(fields => new Promise((resolve, reject) => {
    let currentType = type
    let currentIds = []
    let currentOptions

    // Coerce field into an array.
    if (!Array.isArray(fields)) fields = [ fields ]

    // `cursor` refers to the current collection of records.
    return fields.reduce((records, field) => records.then(cursor => {
      if (!currentType || !(field in recordTypes[currentType]))
        return []

      const idCache = new Set()

      currentType = recordTypes[currentType][field][linkKey]
      currentOptions = 'includeOptions' in context.request ?
        context.request.includeOptions[currentType] : null
      currentIds = cursor.reduce((ids, record) => {
        const linkedIds = Array.isArray(record[field]) ?
          record[field] : [ record[field] ]

        for (let id of linkedIds)
          if (id && !idCache.has(id)) {
            idCache.add(id)
            ids.push(id)
          }

        return ids
      }, [])

      const args = [ currentType, currentIds ]

      args.push(currentOptions ? currentOptions : null)
      if (meta) args.push(meta)

      return currentIds.length ? adapter.find(...args) : []
    }), Promise.resolve(records))
    .then(records => resolve({
      type: currentType,
      ids: currentIds,
      records
    }), error => reject(error))
  })))

  .then(containers => {
    const include = containers.reduce((include, container) => {
      if (!container.ids.length) return include

      if (!(container.type in include))
        include[container.type] = []

      // Only include unique IDs per type.
      if (!(container.type in idCache))
        idCache[container.type] = new Set()

      for (let id of container.ids) {
        if (idCache[container.type].has(id)) continue

        const record = find(container.records, matchId.bind(null, id))

        if (record) {
          idCache[container.type].add(id)
          include[container.type].push(record)
        }
      }

      // If nothing so far, delete the type from include.
      if (!include[container.type].length)
        delete include[container.type]

      return include
    }, {})

    if (Object.keys(include).length)
      Object.defineProperty(context.response, 'include', {
        configurable: true,
        value: include
      })

    return context
  })
}


function matchId (id, record) {
  return record[primaryKey] === id
}
