module.exports = function (query) {

  if (query.hasOwnProperty('include')) {
    query.linked = query.include.split(',').map(function (field) {
      return field.split('.');
    });
    delete query.include;
  }

  return query;
};
