import { ReservedKeys as keys } from '../../schema';

/*!
 * Fetch included entities. This mutates `context`.response`
 * for the next method.
 *
 * @return {Promise}
 */
export default function (context) {
  let include = context.request.include || [];
  let type = context.request.type;
  let entities = context.response._entities;

  // This cache is used to keep a hash table of unique IDs per type.
  let idCache = {};
  idCache[type] = context.request.ids.reduce((hash, id) => {
    hash[id] = true;
    return hash;
  }, {});

  // It's necessary to iterate over primary entities if no IDs were
  // provided initially.
  if (!context.request.ids.length)
    entities.forEach(entity =>
      idCache[type][entity[type in this.options.primaryKeyPerType ?
      this.options.primaryKeyPerType[type] : this.options.primaryKey]] = true);

  return Promise.all(include.map(fields => new Promise(resolve => {
    let currentType = type;
    let currentIds = [];
    let currentOptions = {};

    // Coerce field into an array.
    if (!Array.isArray(fields))
      fields = [fields];

    // `cursor` refers to the current collection of entities.
    return fields.reduce((entities, field) => entities.then(cursor => {
      if (!currentType || !(field in this.schemas[currentType]))
        return [];

      let idCache = {};

      currentType = this.schemas[currentType][field][keys.link];
      currentIds = cursor.reduce((ids, entity) => {

        (Array.isArray(entity[field]) ?
          entity[field] : [entity[field]]).forEach(id => {
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
    }), Promise.resolve(entities))
      .then(entities => resolve({
        type: currentType,
        ids: currentIds,
        entities: entities
      }));
  }))).then(containers => {
    let include = containers.reduce((include, container) => {
      if (!container.ids.length) return include;

      include[container.type] = include[container.type] || [];

      // Only include unique IDs per type.
      idCache[container.type] = idCache[container.type] || {};
      container.ids.slice(0, container.entities.length)
        .forEach((id, index) => {
          if (!!id && !(id in idCache[container.type])) {
            idCache[container.type][id] = true;
            include[container.type].push(container.entities[index]);
          }
        });

      // If nothing so far, delete the type from include.
      if (!include[container.type].length)
        delete include[container.type];

      return include;
    }, {});

    if (Object.keys(include).length)
      context.response._include = include;

    return context;
  });
}
