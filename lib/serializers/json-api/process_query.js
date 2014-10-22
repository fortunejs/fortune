var reservedQueries = ['include', 'fields', 'sort'];


module.exports = function (context) {
  var query = context.query;

  // assume that each non-reserved query parameter is requesting a match
  // on that field
  Object.keys(query).forEach(function (name) {
    if (!~reservedQueries.indexOf(name)) {
      query.match = query.match || {};
      query.match[name] = query[name];
      delete query[name];
    }
  });

  // process `include` query into internal array format
  // comma seperated and dot notated, expanded into arrays
  if (query.hasOwnProperty('include')) {
    query.include = query.include.split(',').map(function (field) {
      return field.split('.');
    });
  }

  return query;
};
