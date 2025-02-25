import { DatabaseUniquenessError } from './database-uniqueness.error'

describe('databaseUniquenessError', () => {
  describe('when a message is passed as the first argument', () => {
    describe('when the cause does not have code = 23505', () => {
      it('should throw an error', () => {
        expect(() => {
          new DatabaseUniquenessError('message', {
            cause: { code: 'not 23505' }
          })
        }).toThrow(/Not a unique constraint violation\./)
      })
    })

    describe('when cause.detail is null/undefined', () => {
      it('should set the column and value properties to an empty string', () => {
        const err = new DatabaseUniquenessError('message', {
          cause: { code: '23505' }
        })
        expect(err.column).toBe('')
        expect(err.value).toBe('')

        const err2 = new DatabaseUniquenessError('message', {
          cause: { code: '23505', detail: null }
        })
        expect(err2.column).toBe('')
        expect(err2.value).toBe('')
      })
    })

    describe('when cause.detail is a string of the expected format', () => {
      it('should set the column and value properties', () => {
        const err = new DatabaseUniquenessError('message', {
          cause: { code: '23505', detail: 'Key (slug)=(goron) already exists.' }
        })
        expect(err.column).toBe('slug')
        expect(err.value).toBe('goron')
      })
    })

    describe('when cause.detail is a string in an unexpected format', () => {
      it('should set the column and value properties to an empty string', () => {
        const err = new DatabaseUniquenessError('message', {
          cause: { code: '23505', detail: 'Key slug=(value) womp.' }
        })
        expect(err.column).toBe('')
        expect(err.value).toBe('')
      })
    })

    describe('when cause.table is set', () => {
      it('should set the table property', () => {
        const err = new DatabaseUniquenessError('message', {
          cause: {
            code: '23505',
            detail: 'Key (slug)=(goron) already exists.',
            table: 'character'
          }
        })
        expect(err.table).toBe('character')
      })
    })

    describe('when cause.table is not set', () => {
      it('should set the table property to an empty string', () => {
        const err = new DatabaseUniquenessError('message', {
          cause: { code: '23505', detail: 'Key (slug)=(goron) already exists.' }
        })
        expect(err.table).toBe('')
      })
    })
  })

  describe('when an error is passed as the first argument', () => {
    describe('when code != 23505', () => {
      it('should throw an error', () => {
        expect(() => {
          new DatabaseUniquenessError({ code: 'not 23505' })
        }).toThrow(/Not a unique constraint violation\./)
      })
    })

    describe('when detail is null/undefined', () => {
      it('should set the column and value properties to an empty string', () => {
        const err = new DatabaseUniquenessError({
          code: '23505'
        })
        expect(err.column).toBe('')
        expect(err.value).toBe('')

        const err2 = new DatabaseUniquenessError({
          code: '23505',
          detail: null
        })
        expect(err2.column).toBe('')
        expect(err2.value).toBe('')
      })
    })

    describe('when detail is a string of the expected format', () => {
      it('should set the column and value properties', () => {
        const err = new DatabaseUniquenessError({
          code: '23505',
          detail: 'Key (slug)=(goron) already exists.'
        })
        expect(err.column).toBe('slug')
        expect(err.value).toBe('goron')
      })
    })

    describe('when detail is a string in an unexpected format', () => {
      it('should set the column and value properties to an empty string', () => {
        const err = new DatabaseUniquenessError({
          code: '23505',
          detail: 'Key slug=(value) womp.'
        })
        expect(err.column).toBe('')
        expect(err.value).toBe('')
      })
    })

    describe('when table is set', () => {
      it('should set the table property', () => {
        const err = new DatabaseUniquenessError({
          code: '23505',
          detail: 'Key (slug)=(goron) already exists.',
          table: 'character'
        })
        expect(err.table).toBe('character')
      })
    })

    describe('when table is not set', () => {
      it('should set the table property to an empty string', () => {
        const err = new DatabaseUniquenessError({
          code: '23505',
          detail: 'Key (slug)=(goron) already exists.'
        })
        expect(err.table).toBe('')
      })
    })

    describe('when the violation is a primary key', () => {
      it('works', () => {
        const err = new DatabaseUniquenessError({
          code: '23505',
          constraint: 'metadata_database_pkey',
          detail:
            'Key (organization_id, slug)=(20f7310b-304f-4c13-9b94-ec2051aa817c, sort_xyz-daf908) already exists.',
          file: 'nbtinsert.c',
          length: 287,
          line: '663',
          name: 'error',
          routine: '_bt_check_unique',
          schema: 'public',
          severity: 'ERROR',
          table: 'metadata_database'
        })
        expect(err.table).toBe('metadata_database')
        expect(err.column).toBe('organization_id, slug')
        expect(err.value).toBe(
          '20f7310b-304f-4c13-9b94-ec2051aa817c, sort_xyz-daf908'
        )
        expect(err.constraint).toBe('metadata_database_pkey')
      })
    })
  })
})
