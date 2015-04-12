/**
 * Micro API serializer.
 */
export default Serializer => {
  class MicroApiSerializer extends Serializer {}

  MicroApiSerializer.id = 'application/vnd.micro+json'

  return MicroApiSerializer
}
