import Adapter from '../../';
import stderr from '../../../common/stderr';


export default class nedbAdapter extends Adapter {

  find (type, ids, options) {
    stderr.info(...arguments);
    let types = {
      user: [
        {_id: 1, pets: [1,2,3]},
        {_id: 2, pets: [1,3,4]}
      ],
      animal: [
        {__id: 3, owner: 4}
      ]
    };
    return Promise.resolve(types[type] || []);
  }


  create (type, entities) {
    return Promise.resolve(entities);
  }


  update (type, updates) {
    stderr.info(...arguments);
    return super.update(...arguments);
  }

}
