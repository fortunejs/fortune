import keys from '../../schema/reserved_keys';


/*!
 * Fetch included records. This mutates `context`.response`
 * for the next method.
 *
 * @return {Promise}
 */
export default function (context) {
  let include = context.request.include || [];
  let type = context.request.type;
  let records = context.response.payload.records;

  // This cache is used to keep a hash table of unique IDs per type.
  let idCache = {};
  idCache[type] = context.request.ids.reduce((hash, id) => {
    hash[id] = true;
    return hash;
  }, {});

  // It's necessary to iterate over primary records if no IDs were
  // provided initially.
  if (!context.request.ids.length)
    records.forEach(record =>
      idCache[type][record[type in this.options.primaryKeyPerType ?
      this.options.primaryKeyPerType[type] : this.options.primaryKey]] = true);

  return Promise.all(include.map(fields => new Promise(resolve => {
    let currentType = type;
    let currentIds = [];
    let currentOptions = {};

    // Coerce field into an array.
    if (!Array.isArray(fields))
      fields = [fields];

    // `cursor` refers to the current collection of records.
    return fields.reduce((records, field) => records.then(cursor => {
      if (!currentType || !(field in this.schemas[currentType]))
        return [];

      let idCache = {};

      currentType = this.schemas[currentType][field][keys.link];
      currentIds = cursor.reduce((ids, record) => {

        (Array.isArray(record[field]) ?
          record[field] : [record[field]]).forEach(id => {
            if (!!id && !(id in idCache)) {
              idCache[id] = true;
              ids.push(id);
            }
          });

        return ids;
      }, []);

      if (currentType in context.request.optionsPerType)
        currentOptions = currentType === type ?
          Object.assign(context.request.options,
            context.request.optionsPerType[currentType]) :
          context.request.optionsPerType[currentType];

      return currentIds.length ?
        this.adapter.find(currentType, currentIds, currentOptions) : [];
    }), Promise.resolve(records))
      .then(records => resolve({
        type: currentType,
        ids: currentIds,
        records: records
      }));
  }))).then(containers => {
    let include = containers.reduce((include, container) => {
      if (!container.ids.length) return include;

      include[container.type] = include[container.type] || [];

      // Only include unique IDs per type.
      idCache[container.type] = idCache[container.type] || {};
      container.ids.slice(0, container.records.length)
        .forEach((id, index) => {
          if (!!id && !(id in idCache[container.type])) {
            idCache[container.type][id] = true;
            include[container.type].push(container.records[index]);
          }
        });

      // If nothing so far, delete the type from include.
      if (!include[container.type].length)
        delete include[container.type];

      return include;
    }, {});

    if (Object.keys(include).length)
      context.response.payload.include = include;

    return context;
  });
}
