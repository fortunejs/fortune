export default Serializer => {

  /**
   * Micro API serializer.
   */
  class MicroApiSerializer extends Serializer {}

  MicroApiSerializer.id = 'application/vnd.micro+json'

  return MicroApiSerializer

}
