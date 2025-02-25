import { SqlValidationQueryService } from './sql.service'

describe('SqlValidationQueryService', () => {
  it('should validate basic, legitimate SQL', async () => {
    const service = new SqlValidationQueryService(
      'connectionId',
      'postgres',
      'SELECT * FROM public.users;'
    )
    const validation = service.validate()

    expect(validation.is_sort_queryable).toBe(true)
    expect(validation.query).toBe('SELECT * FROM public.users;')
    expect(validation.database).toBe('postgres')
  })

  it('should validate basic, legitimate SQL w/ SET search_path', async () => {
    const service = new SqlValidationQueryService(
      'connectionId',
      'postgres',
      'SET search_path TO public; SELECT * FROM public.users;'
    )
    const validation = service.validate()

    expect(validation.is_sort_queryable).toBe(true)
    expect(validation.query).toBe(
      'SET search_path TO public; SELECT * FROM public.users;'
    )
    expect(validation.database).toBe('postgres')
  })

  it('should error on 0 SELECT SQL statements', async () => {
    try {
      const service = new SqlValidationQueryService(
        'connectionId',
        'postgres',
        ''
      )
      service.validate()
      fail('should have thrown an error')
    } catch (e) {
      expect(e).toBeInstanceOf(Error)
      expect((e as Error).message).toBe('SQL is required')
    }
  })

  it('should invalidate two SELECT SQL statements', async () => {
    const service = new SqlValidationQueryService(
      'connectionId',
      'postgres',
      'SELECT * FROM public.users; SELECT * FROM public.user_api_keys'
    )
    const validation = service.validate()

    expect(validation.is_sort_queryable).toBe(false)
    expect(validation.query).toBe(
      'SELECT * FROM public.users; SELECT * FROM public.user_api_keys'
    )
    expect(validation.database).toBe('postgres')
    expect(validation.error).toBe(
      'Only one SELECT query with one SET is supported'
    )
  })

  it('should invalidate an INSERT, SELECT SQL statement', async () => {
    const service = new SqlValidationQueryService(
      'connectionId',
      'postgres',
      'INSERT INTO v (x) VALUES (2); SELECT * FROM public.user_api_keys'
    )
    const validation = service.validate()

    expect(validation.is_sort_queryable).toBe(false)
    expect(validation.query).toBe(
      'INSERT INTO v (x) VALUES (2); SELECT * FROM public.user_api_keys'
    )
    expect(validation.database).toBe('postgres')
    expect(validation.error).toBe(
      'Only one SELECT query with one SET is supported'
    )
  })

  it('should invalidate creation, insert statements in SQL', async () => {
    const service = new SqlValidationQueryService(
      'connectionId',
      'postgres',
      'INSERT INTO v (x) VALUES (2)'
    )
    const validation = service.validate()

    expect(validation.is_sort_queryable).toBe(false)
    expect(validation.query).toBe('INSERT INTO v (x) VALUES (2)')
    expect(validation.database).toBe('postgres')
    expect(validation.error).toBe('Only SELECT statements are supported')

    const service2 = new SqlValidationQueryService(
      'connectionId',
      'postgres',
      'UPDATE v SET x = 2 WHERE y = 1'
    )
    const validation2 = service2.validate()

    expect(validation2.is_sort_queryable).toBe(false)
    expect(validation2.query).toBe('UPDATE v SET x = 2 WHERE y = 1')
    expect(validation2.database).toBe('postgres')
    expect(validation2.error).toBe('Only SELECT statements are supported')
  })

  it('should invalidate mixed creation, select statements in SQL', async () => {
    const service = new SqlValidationQueryService(
      'connectionId',
      'postgres',
      'INSERT INTO v (x) VALUES (2); SELECT * FROM public.users; SELECT * FROM public.user_api_keys'
    )
    const validation = service.validate()

    expect(validation.is_sort_queryable).toBe(false)
    expect(validation.query).toBe(
      'INSERT INTO v (x) VALUES (2); SELECT * FROM public.users; SELECT * FROM public.user_api_keys'
    )
    expect(validation.database).toBe('postgres')
    expect(validation.error).toBe(
      'Only one SELECT query with one SET is supported; or one SELECT query'
    )
  })

  it('should invalidate invalid SQL', async () => {
    const service = new SqlValidationQueryService(
      'connectionId',
      'postgres',
      'INSERT INTO x) VALUES (2)'
    )
    const validation = service.validate()

    expect(validation.is_sort_queryable).toBe(false)
    expect(validation.query).toBe('INSERT INTO x) VALUES (2)')
    expect(validation.database).toBe('postgres')
    expect(validation.error).toContain('Syntax error at line 1 col 14')
  })

  it('should invalidate invalid quotes', async () => {
    const service = new SqlValidationQueryService(
      'connectionId',
      'postgres',
      "select * from public.jobs WHERE job_title = 'Data Science’"
    )
    const validation = service.validate()

    expect(validation.is_sort_queryable).toBe(false)
    expect(validation.query).toBe(
      "select * from public.jobs WHERE job_title = 'Data Science’"
    )
    expect(validation.database).toBe('postgres')
    expect(validation.error).toContain('invalid syntax at line 1 col 45')
  })

  it('should validate SQL with a WITH statement', async () => {
    const service = new SqlValidationQueryService(
      'connectionId',
      'postgres',
      'with something as (SELECT id, snapshot_id, name FROM public.snapshot_database) select * from something'
    )
    const validation = service.validate()

    expect(validation.is_sort_queryable).toBe(true)
    expect(validation.query).toBe(
      'with something as (SELECT id, snapshot_id, name FROM public.snapshot_database) select * from something'
    )
    expect(validation.database).toBe('postgres')
  })

  it('should invalidate SQL with an INTO statement', async () => {
    const service = new SqlValidationQueryService(
      'connectionId',
      'postgres',
      'SELECT * INTO new_table FROM public.users;'
    )
    const validation = service.validate()

    expect(validation.is_sort_queryable).toBe(false)
    expect(validation.query).toBe('SELECT * INTO new_table FROM public.users;')
    expect(validation.database).toBe('postgres')

    const service2 = new SqlValidationQueryService(
      'connectionId',
      'postgres',
      'SET search_path TO public; SELECT * INTO new_table FROM public.users;'
    )
    const validation2 = service2.validate()

    expect(validation2.is_sort_queryable).toBe(false)
    expect(validation2.query).toBe(
      'SET search_path TO public; SELECT * INTO new_table FROM public.users;'
    )
    expect(validation2.database).toBe('postgres')
  })

  it('should invalidate SQL with misspelled SELECT', async () => {
    const service = new SqlValidationQueryService(
      'connectionId',
      'postgres',
      'ELECT d, * FROM public.users AS u JOIN public.not_users AS nu ON nu.id = u.user_id;'
    )
    const validation = service.validate()

    expect(validation.is_sort_queryable).toBe(false)
    expect(validation.query).toBe(
      'ELECT d, * FROM public.users AS u JOIN public.not_users AS nu ON nu.id = u.user_id;'
    )
    expect(validation.database).toBe('postgres')
  })

  it('should invalidate SQL with misspelled ORDER', async () => {
    const query = 'SELECT * FROM public.users orrder by id;'
    const service = new SqlValidationQueryService(
      'connectionId',
      'postgres',
      query
    )
    const validation = service.validate()

    expect(validation.is_sort_queryable).toBe(false)
    expect(validation.query).toBe(query)
    expect(validation.database).toBe('postgres')
    expect(validation.error).toContain('Syntax error at line 1 col 35')
  })

  it('should invalidate SQL with LIMIT out of order', async () => {
    const query = 'SELECT * \nFROM public.users \nlimit 3 \norder by id;'
    const service = new SqlValidationQueryService(
      'connectionId',
      'postgres',
      query
    )
    const validation = service.validate()

    expect(validation.is_sort_queryable).toBe(false)
    expect(validation.query).toBe(query)
    expect(validation.database).toBe('postgres')
    expect(validation.error).toContain('Syntax error at line 4 col 1')
  })
})
