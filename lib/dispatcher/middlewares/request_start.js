import errors from '../../common/errors';


const idempotentAction = 'find';


export default function (context) {
  let action = context.request.action;
  let type = context.request.type;
  let ids = context.request.ids;

  // Block request if type is invalid.
  if ((action !== idempotentAction || type) &&
    !this.schemas.hasOwnProperty(type))
      throw new errors.NotFoundError(`The requested type "${type}" ` +
        `is not a valid type.`);

  // Make sure IDs are an array of unique values.
  context.request.ids = [...new Set(Array.isArray(ids) ? ids : [ids])];

  return context;
}
