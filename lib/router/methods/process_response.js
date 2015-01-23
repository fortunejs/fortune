/*!
 * Apply `after` transform per entity, then run the serializer.
 * This mutates `context`.response` for the next method.
 *
 * @return {Promise}
 */
export default function (context) {
  let type = context.request.type;

  return (typeof this.transforms[type].after === 'function' ?
    Promise.all(context.response._entities.map(entity =>
      new Promise(resolve => resolve(
        this.transforms[type].after.call(entity, context)
      ))
    )) : Promise.resolve(context.response._entities))

    .then(entities => {
      context.response._entities = entities;

      if ('_include' in context.response) {
        this.serializer.showResource(
          context, entities, context.response._include);
      } else {
        this.serializer.showResource(context, entities);
      }

      return context;
    });

}
