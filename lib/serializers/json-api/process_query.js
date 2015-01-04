var inflection = require('inflection');


var reservedQueries = ['include', 'fields', 'sort', 'limit', 'offset'];


module.exports = function (context) {
  var query = context.query;
  var reserved;
  var key;
  var i;

  for (key in query) {

    for (i = 0; i < reservedQueries.length; i++) {
      if (new RegExp('^' + reservedQueries[i]).test(key)) {
        reserved = reservedQueries[i];
        break;
      }
    }

    // sorting by type is a special case, it has an additional parameter
    // that looks like `sort[type]`, so this must be processed
    if (reserved === 'sort') {
      var type = (key.match(/\[([^\]]+)\]/) || [])[1];

      if (type !== undefined) {
        if (!!this.options.inflect) {
          type = inflection.singularize(type);
        }
        query.sort = {};
        query.sort[type] = processSort(query[key]);
        delete query[key];
      }
    }

    // otherwise assume that each non-reserved query parameter is requesting
    // a match on that field
    else if (reserved === undefined) {
      query.match = query.match || {};
      query.match[key] = ~query[key].indexOf(',') ?
        query[key].split(',') : query[key];
      delete query[key];
    }
  }

  // process `include` query into internal array format
  // comma seperated and dot notated, expanded into arrays
  if (query.hasOwnProperty('include')) {
    query.include = query.include.split(',').map(function (field) {
      return field.split('.');
    });
  }

  // process sorting, if type-specific sorting does not already exist
  if (typeof query.sort === 'string') {
    var sortObject = processSort(query.sort);

    query.sort = {};
    query.sort[context.type] = sortObject;
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


/*!
 * Process sort string.
 *
 * @param {String} sort
 * @return {Object}
 */
function processSort (sort) {
  var sortObject = {};

  sort.split(',').forEach(function (key) {
    var descending = key.charAt(0) === '-';
    sortObject[descending ? key.slice(1) : key] = descending ? -1 : 1;
  });

  return sortObject;
}
