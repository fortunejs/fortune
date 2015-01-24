import enforce from '../../schemas/enforcer';

/*!
 * Apply `after` transform per entity, then run the serializer.
 * This mutates `context.response` for the next method.
 *
 * @return {Promise}
 */
export default function (context) {
  let type = context.request.type;
  let entities = context.response._entities;
  let include = context.response._include;

  // Run transforms on primary type.
  return Promise.all(entities.map(entity => new Promise(resolve => {
    return new Promise(resolve => resolve('after' in (this.transforms[type] || {}) ?
      this.transforms[type].after.call(entity, context) : entity))
      .then(entity => {
        // Enforce the schema after running transform.
        entity = enforce(entity, this.schemas[type], true);
        return resolve(entity);
      });

  }))).then(entities => {
    context.response._entities = entities;

    // The order of the keys and their corresponding indices matter.
    let includeTypes = Object.keys(include || {});

    // Run transforms per include type.
    return Promise.all(includeTypes.map(includeType => new Promise(resolve =>
      resolve(Promise.all(include[includeType].map(entity =>
        new Promise(resolve => {
          return new Promise(resolve => resolve(
            'after' in (this.transforms[includeType] || {}) ?
            this.transforms[includeType].after.call(entity, context) : entity))
            .then(entity => {
              // Enforce the schema after running transform.
              entity = enforce(entity, this.schemas[includeType], true);
              return resolve(entity);
            });
      })))
    )))).then(types => types.reduce((include, entities, index) => {
      include[includeTypes[index]] = entities;
      return include;
    }, {}));

  }).then(include => {
    if (Object.keys(include).length) {
      context.response._include = include;
      this.serializer.showResource(context, entities, include);
    } else {
      delete context.response._include;
      this.serializer.showResource(context, entities);
    }
    return context;
  });
}
