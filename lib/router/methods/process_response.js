import enforce from '../../schemas/enforcer';

/*!
 * Apply `after` transform per entity, then run the serializer.
 * This mutates `context.response` for the next method.
 *
 * @return {Promise}
 */
export default function (context) {
  let type = context.request.type;

  return ('after' in (this.transforms[type] || {}) ?

    // Run transforms on the primary type.
    Promise.all(context.response._entities.map(entity =>
      new Promise(resolve => resolve(
        this.transforms[type].after.call(entity, context)
      ))
    )) : Promise.resolve(context.response._entities))

    .then(entities => {
      // Enforce the schema on primary type after running transform.
      context.response._entities = entities.map(entity =>
        enforce(entity, this.schemas[type], true));

      // Run transforms on included entities.
      return new Promise(resolve => {
        let includedTypes = Object.keys(context.response._include || {});
        return resolve(Promise.all(includedTypes.map(includedType =>
          ('after' in (this.transforms[includedType] || {}) ?
            Promise.all(context.response._include[includedType].map(entity =>
              new Promise(resolve => resolve(
                this.transforms[includedType].after.call(entity, context)
              ))
            )) : Promise.resolve(context.response._include[includedType]))
        )).then(types => {
          context.response._include = types.reduce(
            (include, entities, index) => {
              include[includedTypes[index]] = entities;
              return include;
            }, {});
          return context.response._include;
        }));
      });

    }).then(include => {
      // Enforce the schemas on include after running transform.
      context.response._include = Object.keys(include || {})
        .reduce((obj, includedType) => {
          obj[includedType] = include[includedType].map(entity =>
            enforce(entity, this.schemas[includedType], true));
          return obj;
        }, {});

      // Remove include if nothing is included.
      if (!Object.keys(context.response._include).length)
        delete context.response._include;

      // Serialize the response.
      if ('_include' in context.response) {
        this.serializer.showResource(
          context, context.response._entities, context.response._include);
      } else {
        this.serializer.showResource(context, context.response._entities);
      }

      return context;
    });
}
