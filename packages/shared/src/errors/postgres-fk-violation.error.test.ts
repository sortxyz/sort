import { PostgresFkViolationError } from './postgres-fk-violation.error'

describe('PostgresFkViolationError', () => {
  describe('isViolationError()', () => {
    it('works properly', () => {
      expect(PostgresFkViolationError.isViolationError({ code: '23505' })).toBe(
        false
      )
      expect(PostgresFkViolationError.isViolationError({ code: '23503' })).toBe(
        true
      )
    })
  })

  describe('when a message is passed as the first argument', () => {
    describe('when the cause does not have code = 23505', () => {
      it('should throw an error', () => {
        expect(() => {
          new PostgresFkViolationError('message', {
            cause: { code: 'not 23503' }
          })
        }).toThrow(/Not a foreign key constraint violation\./)
      })
    })

    describe('when cause.detail is null/undefined', () => {
      it('should set detail property to empty string', () => {
        const err = new PostgresFkViolationError('message', {
          cause: { code: '23503' }
        })
        expect(err.detail).toEqual('')

        const err2 = new PostgresFkViolationError('message', {
          cause: { code: '23503', detail: null }
        })
        expect(err2.detail).toEqual('')
      })
    })

    describe('when cause.detail is a string', () => {
      it('should set the detail property', () => {
        const detail =
          'Key (metadata_table_name, metadata_schema_name, metadata_database_name, connection_id)=(non_existent_table, test, sort_xyz, f17a3e28-a901-42ac-981a-2f619167d637) is not present in table "metadata_table".'
        const err = new PostgresFkViolationError('message', {
          cause: {
            code: '23503',
            detail
          }
        })
        expect(err.detail).toEqual(detail)
      })
    })

    describe('when cause.constraint is set', () => {
      it('should set the constraint property', () => {
        const err = new PostgresFkViolationError('message', {
          cause: {
            code: '23503',
            detail: 'Key (slug)=(goron) already exists.',
            constraint: 'fk_xyz'
          }
        })
        expect(err.constraint).toBe('fk_xyz')
      })
    })

    describe('when options include table/schema/database names', () => {
      it('should include them in the metadata property', () => {
        const meta = {
          tableName: 'table',
          schemaName: 'schema',
          databaseName: 'database'
        }

        const err = new PostgresFkViolationError('message', {
          cause: {
            code: '23503',
            detail: 'Key (slug)=(goron) already exists.',
            constraint: 'fk_xyz'
          },
          ...meta
        })
        expect(err.constraint).toBe('fk_xyz')
        expect(err.metadata).toEqual(meta)
      })
    })

    describe('when cause.constraint is not set', () => {
      it('should set the constraint property to an empty string', () => {
        const err = new PostgresFkViolationError('message', {
          cause: { code: '23503', detail: 'Key (slug)=(goron) already exists.' }
        })
        expect(err.constraint).toBe('')
      })
    })
  })

  describe('when an error is passed as the first argument', () => {
    describe('when code != 23503', () => {
      it('should throw an error', () => {
        expect(() => {
          new PostgresFkViolationError({ code: 'not 23503' })
        }).toThrow(/Not a foreign key constraint violation\./)
      })
    })

    describe('when detail is null/undefined', () => {
      it('should set detail property to empty string', () => {
        const err = new PostgresFkViolationError({ code: '23503' })
        expect(err.detail).toEqual('')

        const err2 = new PostgresFkViolationError({
          code: '23503',
          detail: null
        })
        expect(err2.detail).toEqual('')
      })
    })

    describe('when detail is a string of the expected format', () => {
      it('should set the detail property', () => {
        const detail =
          'Key (metadata_table_name)=(non_existent_table) is not present in table "bonk".'
        const err = new PostgresFkViolationError({
          code: '23503',
          detail
        })
        expect(err.detail).toEqual(detail)
      })
    })

    describe('when cause.constraint is set', () => {
      it('should set the constraint property', () => {
        const err = new PostgresFkViolationError({
          code: '23503',
          detail: 'Key (slug)=(goron) already exists.',
          constraint: 'fk_xyz'
        })
        expect(err.constraint).toStrictEqual('fk_xyz')
      })
    })

    describe('when cause.constraint is not set', () => {
      it('should set the constraint property to an empty string', () => {
        const err = new PostgresFkViolationError({
          code: '23503',
          detail: 'Key (slug)=(goron) already exists.'
        })
        expect(err.constraint).toStrictEqual('')
      })
    })

    describe('when options include table/schema/database names', () => {
      it('should include them in the metadata property', () => {
        const meta = {
          tableName: 'table',
          schemaName: 'schema',
          databaseName: 'database'
        }

        const err = new PostgresFkViolationError(
          {
            code: '23503',
            detail: 'Key (slug)=(goron) already exists.',
            constraint: 'fk_xyz'
          },
          meta
        )
        expect(err.constraint).toBe('fk_xyz')
        expect(err.metadata).toEqual(meta)
      })
    })
  })
})
