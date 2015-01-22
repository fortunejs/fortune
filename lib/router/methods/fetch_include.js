import keys from '../../schemas/reserved_keys';

/*!
 * Fetch included entities. This mutates `context`.response`
 * for the next method.
 *
 * @return {Promise}
 */
export default function (context) {
  let include = context.request.include || [];
  let requestType = context.request._relatedType || context.request.type;

  return Promise.all(include.map(fields => new Promise(resolve => {
    let type = requestType;

    // `cursor` refers to the current collection of entities.
    return fields.reduce((entities, field) => entities.then(cursor => {
      if (!type || !(field in this.schemas[type])) {
        type = undefined;
        return [];
      }
      type = this.schemas[type][field][keys.link];
      return this.adapter.find(type, cursor.reduce((ids, entity) => {
        let relatedIds = Array.isArray(entity[field]) ?
          entity[field] : [entity[field]];

        // Assume IDs per field are unique.
        ids.push(...relatedIds.filter(id => !!id && !~ids.indexOf(id)));

        return ids;
      }, []));
    }), Promise.resolve(context.response._entities))
      .then(entities => resolve({
        type: type,
        entities: entities
      }));
  }))).then(containers => {
    let include = containers.reduce((include, container) => {
      if (container.type === undefined) return include;

      include[container.type] = include[container.type] || [];
      let ids = include[container.type].map(entity => entity.id);

      // Special case if the included type matches the requested type,
      // don't include anything that's already in the primary request.
      if (container.type === requestType)
        ids.push(...context.response._entities.map(entity => entity.id));

      // When combining IDs from different entities, some might overlap.
      include[container.type].push(...container.entities.filter(entity => {
        return !~ids.indexOf(entity.id);
      }));

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
