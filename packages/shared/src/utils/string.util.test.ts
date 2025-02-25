import { capitalizeWord, hydrateSQLString, mdToHtml } from './string.util'

describe('v2/utils/string.utils', () => {
  describe('hydrateSQLString', () => {
    it('should replace $n with params', () => {
      const raw = 'select * from $1 where id = $2 and name = $3'
      const params = ['cats', 1, 'test']
      const result = hydrateSQLString(raw, params)
      expect(result).toBe('select * from cats where id = 1 and name = test')
    })
  })

  describe('mdToHtml', () => {
    it('should convert markdown to html', async () => {
      const result = await mdToHtml('**Hello**<hr>world')
      expect(result).toBe('<strong>Hello</strong><hr>world')
    })
  })

  describe('capitalizeWord', () => {
    it('should capitalize the first letter of a word', () => {
      const result = capitalizeWord('hello world')
      expect(result).toBe('Hello world')
    })
  })
})
