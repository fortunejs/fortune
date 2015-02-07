import Serializer from '../../';

export default class jsonApiSerializer extends Serializer {
  processResponse (context) {
    console.log('testing');
    return context;
  }
}
