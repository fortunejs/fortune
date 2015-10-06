import { run, comment, equal } from 'tapdance'
import httpTest from '../integration/http_test'


const test = httpTest.bind(null, undefined)


run(() => {
  comment('content negotiation')
  return test('/', {
    headers: { 'Accept': 'text/html' }
  }, response => {
    equal(response.status, 406, 'status is correct')
  })
})
