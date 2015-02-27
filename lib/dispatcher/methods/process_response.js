import enforcer from '../../schema/enforcer';


/*!
 * Apply `after` transform per entity, then run the serializer.
 * This mutates `context.response` for the next method.
 *
 * @return {Promise}
 */
export default function (context) {
  let options = this.options;
  let type = context.request.type;
  let entities = context.response._entities;
  let include = context.response._include;

  // Run transforms on primary type.
  return Promise.all(entities.map(entity => new Promise(resolve => {
    return new Promise(resolve =>
      resolve('after' in (this.transforms[type] || {}) ?
      this.transforms[type].after(context, entity) : entity))
      .then(entity => {
        // Enforce the schema after running transform.
        entity = enforcer(entity, this.schemas[type],
          Object.assign(options.schema, { output: true }));
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
            this.transforms[includeType].after(context, entity) : entity))
            .then(entity => {
              // Enforce the schema after running transform.
              entity = enforcer(entity, this.schemas[includeType],
                Object.assign(options.schema, { output: true }));
              return resolve(entity);
            });
      })))
    )))).then(types => types.reduce((include, entities, index) => {
      include[includeTypes[index]] = entities;
      return include;
    }, {}));

  }).then(include => {
    let args = [context, entities];

    if (Object.keys(include).length)
      args.push(include);

    // Remove temporary keys from response.
    delete context.response._include;
    delete context.response._entities;

    context = this.serializer.showResponse(...args);

    return context;
  });
}
