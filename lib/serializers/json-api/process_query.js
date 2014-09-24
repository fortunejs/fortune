module.exports = function (context) {
  var query = context.query;

  if (query.hasOwnProperty('include')) {
    query.include = query.include.split(',').map(function (field) {
      return field.split('.');
    });
  }

  return query;
};
