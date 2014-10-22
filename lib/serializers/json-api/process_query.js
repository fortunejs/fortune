var reservedQueries = ['include', 'fields', 'sort', 'limit', 'offset'];


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

  // process sorting
  if (query.hasOwnProperty('sort')) {
    var sortObject = {};

    query.sort.split(',').forEach(function (sort) {
      var descending = sort.charAt(0) === '-';
      sortObject[descending ? sort.slice(1) : sort] = descending ? -1 : 1;
    });

    query.sort = sortObject;
  }

  // process pagination
  if (query.hasOwnProperty('limit')) {
    query.limit = parseInt(query.limit, 10);
  }
  if (query.hasOwnProperty('offset')) {
    query.offset = parseInt(query.offset, 10);
  }

  return query;
};
