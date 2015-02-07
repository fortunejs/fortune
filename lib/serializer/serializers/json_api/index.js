import url from 'url';
import inflection from 'inflection';
import Serializer from '../../';

const pathDelimiter = '/';
const arrayDelimiter = ',';

const defaults = {
  inflect: true
};

export default class jsonApiSerializer extends Serializer {

  processRequest (context) {
    if (arguments.length === 1)
      return context;

    let request = context.request;
    let systemRequest = arguments[1];
    let urlObject = url.parse(systemRequest.url, true);
    let pathArray = urlObject.pathname.split(pathDelimiter).slice(1);
    let inflect = this.options.inflect || defaults.inflect;

    request.type = inflect ?
      inflection.singularize(pathArray[0]) : pathArray[0];
    request.ids = pathArray[1].split(arrayDelimiter);
    request.relatedField = pathArray[2];

    request.payload = systemRequest.body.length ?
      JSON.parse(systemRequest.body.toString()) : '';

    return context;
  }

  processResponse (context) {
    let payload = context.response.payload;

    if (typeof payload === 'object')
      payload = new Buffer(JSON.stringify(payload, null, 2));

    return context;
  }

}
