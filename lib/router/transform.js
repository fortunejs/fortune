module.exports = {
  before: applyBefore,
  after: applyAfter
};


function applyBefore (type, entities, request, response) {
  var _this = this;

  return Promise.all(entities.map(function (entity) {
    var transform = _this.transforms[type];

    if (!!transform && transform.before) {
      entity = transform.before.call(entity, request, response);
    }

    return entity;
  }));
}


function applyAfter (type, entities, request, response) {
  var _this = this;

  return Promise.all(entities.map(function (entity) {
    var transform = _this.transforms[type];

    if (!!transform && transform.after) {
      entity = transform.after.call(entity, request, response);
    }

    return entity;
  }));
}
