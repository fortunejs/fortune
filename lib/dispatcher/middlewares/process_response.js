import enforcer from '../../schema/enforcer';


/*!
 * Apply `after` transform per record, then run the serializer.
 * This mutates `context.response` for the next method.
 *
 * @return {Promise}
 */
export default function (context) {
  let type = context.request.type;
  let records = context.response.payload.records;
  let include = context.response.payload.include;

  // Run transforms on primary type.
  return Promise.all(records.map(record => new Promise(resolve => {
    return new Promise(resolve =>
      resolve('after' in (this.transforms[type] || {}) ?
        this.transforms[type].after(context, record) : record))

        // Enforce the schema after running transform.
        .then(record => resolve(enforcer(record, this.schemas[type],
          Object.assign(this.schema, { output: true }))));

  }))).then(updatedRecords => {
    records = updatedRecords;

    // The order of the keys and their corresponding indices matter.
    let includeTypes = Object.keys(include || {});

    // Run transforms per include type.
    return Promise.all(includeTypes.map(includeType => new Promise(resolve =>
      resolve(Promise.all(include[includeType].map(record =>
        new Promise(resolve => {
          return new Promise(resolve => resolve(
            'after' in (this.transforms[includeType] || {}) ?
            this.transforms[includeType].after(context, record) : record))
            .then(record => {
              // Enforce the schema after running transform.
              record = enforcer(record, this.schemas[includeType],
                Object.assign(this.schema, { output: true }));
              return resolve(record);
            });
      })))
    )))).then(types => types.reduce((include, records, index) => {
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
