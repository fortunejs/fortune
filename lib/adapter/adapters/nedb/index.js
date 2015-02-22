import Adapter from '../../';


export default class nedbAdapter extends Adapter {

  find (type, ids, options) {
    let types = {
      user: [
        {_id: 1, pets: [1,2,3]},
        {_id: 2, pets: [1,3,4]}
      ],
      animal: [
        {__id: 3, owner: 2}
      ]
    };
    return Promise.resolve(types[type] || []);
  }

  create (type, entities) {
    return Promise.resolve(entities);
  }

}
