
module.exports = function(schema, options){
  var getter = function(v){
    return v += 'mongoosed';
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
