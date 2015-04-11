/**
 * Call the serializer's `showIndex` method if type is missing.
 */
export default function (context) {
  if (!context.request.type)
    context = this.serializer.showIndex(context)

  return context
}
