import stderr from '../../../common/stderr';


export default Adapter => class nedbAdapter extends Adapter {

  find (type) {
    stderr.info('Find', ...arguments);
    let types = {
      user: [
        {[this.primaryKey]: 4, pets: [1, 2, 3]}
      ],
      animal: [
        {[this.primaryKey]: 3, owner: 4}
      ]
    };
    return Promise.resolve(types[type] || []);
  }


  create (type, records) {
    stderr.info('Create', ...arguments);
    return Promise.resolve(records);
  }


  update () {
    stderr.info('Update', ...arguments);
    return super.update(...arguments);
  }

}
