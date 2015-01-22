import Adapter from '../../adapter';

export default class nedbAdapter extends Adapter {
  find (type, ids, options) {
    let types = {
      user: [
        {id: 1, pets: [1,2,3]},
        {id: 2, pets: [1,3,4]}
      ],
      animal: [
        {id: 3, owner: 2}
      ]
    };
    return Promise.resolve(types[type] || []);
  }
}
