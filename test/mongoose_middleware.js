
module.exports = function(schema, options){
  var getter = function(v){
    return /^mongoose-$/.test(v) ? v += 'mongoosed' : v;
  };
  var paths = options.paths;
  schema.pre('init', function(next, doc){
    if (doc){
      paths.forEach(function(p){
        doc[p] = getter(doc[p]);
      })
    }
    next();
  });
};
