import Fortune from '../../lib';
import stderr from '../../lib/common/stderr';


export default () => {

  let app = new Fortune({
    primaryKeyPerType: {
      user: '_id',
      animal: '__id'
    }
  });

  app.model('user', {
    name: String,
    age: {type: Number, min: 0, max: 100},
    friends: {link: 'user', inverse: 'friends'},
    pets: {link: ['animal'], inverse: 'owner'}
  }).after((context, entity) => {
    entity.timestamp = Date.now();
    return Promise.resolve(entity);
  });

  app.model('animal', {
    name: String,
    owner: {link: 'user', inverse: 'pets'}
  }).after((context, entity) => {
    entity.ageOfPet = 123;
    return entity;
  });

  app.dispatcher.on('change', function () {
    stderr.info('Change', ...arguments);
  });

  return app.init();

};
