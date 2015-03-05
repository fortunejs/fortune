export default function (context) {
  // If a type is not specified, not much to do but to show the index.
  if (!context.request.type)
    return new Promise(resolve => {
      context = this.serializer.showIndex(context);
      return resolve(context);
    });

  // Otherwise, continue.
  return Promise.resolve(context);
}
