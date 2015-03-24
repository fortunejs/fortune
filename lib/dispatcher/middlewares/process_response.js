import enforce from '../../schema/enforcer';


/*!
 * Apply `after` transform per record, then run the serializer.
 * This mutates `context.response` for the next method.
 *
 * @return {Promise}
 */
export default function (context) {
  let type = context.request.type;

  if (!type || !(context.response.payload instanceof Object))
    return context;

  let records = context.response.payload.records || [];
  let include = context.response.payload.include || {};

  // Run transforms on primary type.
  return Promise.all(records.map(record => Promise.resolve(
    (this.transforms[type] || {}).hasOwnProperty('after') ?
      this.transforms[type].after(context, record) : record)))

  .then(updatedRecords => {
    records = updatedRecords;

    // The order of the keys and their corresponding indices matter.
    let includeTypes = Object.keys(include);

    // Run transforms per include type.
    return Promise.all(includeTypes.map(includeType =>
      Promise.all(include[includeType].map(record => Promise.resolve(
        (this.transforms[includeType] || {}).hasOwnProperty('after') ?
          this.transforms[includeType].after(context, record) : record)))

    )).then(types => types.reduce((include, records, index) => {
      include[includeTypes[index]] = records;
      return include;
    }, {}));

  }).then(include => {
    let args = [context, records];

    if (Object.keys(include).length)
      args.push(include);

    context = this.serializer.showResponse(...args);

    return context;
  });
}
