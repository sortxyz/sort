/**
 * Most of this file is copied from tests in
 * https://github.com/ShogunPanda/fastify-http-errors-enhanced/blob/6b6a91a82/
 * which is only compatible with strict ESM projects. The code has been modified to
 * meet our lint rules and to increase test coverage.
 *
 * https://github.com/ShogunPanda/fastify-http-errors-enhanced/blob/6b6a91a82/LICENSE.md
 * ISC License
 * Copyright (c) 2019, and above Shogun <shogun@cowtech.it>
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */
import { Ajv } from 'ajv'
import addFormats from 'ajv-formats'

import { convertValidationErrors, niceJoin } from './route-validation.util'

import type {
  SortValidationResult,
  RequestSection
} from './route-validation.util'

const failedFormat = {
  validate(): boolean {
    return false
  }
}

const ajv = new Ajv({
  coerceTypes: true, // just for testing purposes default is 'array'
  useDefaults: true,
  removeAdditional: false, // just for testing purposes default is true
  uriResolver: require('fast-uri'),
  addUsedSchema: false,
  allErrors: true, // just for testing purposes default is false
  formats: {
    invalidResponseCode: {
      validate(raw: number): boolean {
        return raw < 100 && raw > 599
      }
    },
    invalidResponse: {
      validate(raw: number): boolean {
        return raw < 100 && raw > 599
      }
    },
    noMessage: failedFormat,
    contentType: failedFormat,
    json: failedFormat,
    jsonEmpty: failedFormat
  }
})

addFormats(ajv)

const schema = {
  type: 'object',
  properties: {
    type: {
      type: 'boolean'
    },
    nonEmptyObject: {
      type: 'object',
      minProperties: 1
    },
    emptyObject: {
      type: 'object',
      maxProperties: 0
    },
    minProperties: {
      type: 'object',
      minProperties: 2
    },
    maxProperties: {
      type: 'object',
      maxProperties: 2
    },
    nonEmptyArray: {
      type: 'array',
      minItems: 1
    },
    emptyArray: {
      type: 'array',
      maxItems: 0
    },
    minItems: {
      type: 'array',
      minItems: 2
    },
    maxItems: {
      type: 'array',
      maxItems: 2
    },
    minimum: {
      type: 'number',
      minimum: 5
    },
    maximum: {
      type: 'number',
      maximum: 5
    },
    integer: {
      type: 'integer'
    },
    object: {
      type: 'object'
    },
    number: {
      type: 'number'
    },
    array: {
      type: 'array'
    },
    defaultValue: {
      type: 'null'
    },
    enum: {
      type: 'string',
      enum: ['a', 'b', 'c']
    },
    presentString: {
      type: 'string',
      pattern: '.+'
    },
    pattern: {
      type: 'string',
      pattern: '\\d+\\{a\\}abc'
    },
    uuid: {
      type: 'string',
      format: 'uuid'
    },
    hostname: {
      type: 'string',
      format: 'hostname'
    },
    contentType: {
      type: 'string',
      format: 'contentType'
    },
    json: {
      type: 'string',
      format: 'json'
    },
    jsonEmpty: {
      type: 'string',
      format: 'jsonEmpty'
    },
    ipv4: {
      type: 'string',
      format: 'ipv4'
    },
    ipv6: {
      type: 'string',
      format: 'ipv6'
    },
    date: {
      type: 'string',
      format: 'date'
    },
    time: {
      type: 'string',
      format: 'time'
    },
    dateTime: {
      type: 'string',
      format: 'date-time'
    },
    uri: {
      type: 'string',
      format: 'uri'
    },
    noMessage: {
      type: 'string',
      format: 'noMessage'
    },
    arrayPath: {
      type: 'array',
      items: {
        type: 'number'
      }
    },
    objectPath: {
      type: 'object',
      properties: {
        'x-abc': {
          type: 'number'
        },
        cde: {
          type: 'number'
        }
      }
    },
    'needs-quotes': {
      type: 'number'
    },
    uniqueItems: {
      type: 'array',
      uniqueItems: true
    }
  },
  additionalProperties: false,
  required: ['required']
}

const data = {
  unknown: 'unknown',
  type: 'whatever',
  nonEmptyObject: {},
  emptyObject: { a: 1 },
  minProperties: { a: 1 },
  maxProperties: { a: 1, b: 2, c: 3 },
  nonEmptyArray: [],
  emptyArray: [1],
  minItems: [1],
  maxItems: [1, 2, 3],
  minimum: 1,
  maximum: 10,
  integer: 'string',
  object: 'string',
  number: 'string',
  array: 'string',
  defaultValue: 'no',
  enum: 'invalid',
  presentString: '',
  pattern: '123',
  uuid: 'whatever',
  hostname: '...',
  contentType: 'hello',
  json: '',
  jsonEmpty: '',
  ipv4: 'abc',
  ipv6: 'cde',
  date: 'whatever',
  time: 'whatever',
  dateTime: 'whatever',
  uri: 'whatever',
  noMessage: true,
  arrayPath: ['abc'],
  objectPath: {
    'x-abc': 'abc',
    cde: 'cde'
  },
  'needs-quotes': 'nq',
  uniqueItems: [1, 1]
}

const expectedErrors = {
  required: 'is required',
  unknown: 'is not a valid property',
  type: 'must be a valid boolean (true or false)',
  nonEmptyObject: 'cannot be an empty object',
  emptyObject: 'must be an empty object',
  minProperties: 'must be an object with at least 2 properties',
  maxProperties: 'must be an object with at most 2 properties',
  nonEmptyArray: 'cannot be an empty array',
  emptyArray: 'must be an empty array',
  minItems: 'must be an array with at least 2 items',
  maxItems: 'must be an array with at most 2 items',
  'arrayPath/0': 'must be a valid number',
  'objectPath/x-abc': 'must be a valid number',
  'objectPath/cde': 'must be a valid number',
  minimum: 'must be a number greater than or equal to 5',
  maximum: 'must be a number less than or equal to 5',
  integer: 'must be a valid integer number',
  object: 'must be an object',
  number: 'must be a valid number',
  enum: 'must be one of the following values: "a", "b" or "c"',
  presentString: 'must be a non-empty string',
  pattern: 'must match pattern "\\d+\\{a\\}abc"',
  uuid: 'must be a valid GUID (UUID v4)',
  hostname: 'must be a valid hostname',
  contentType:
    'only JSON payloads are accepted. Please set the "Content-Type" header to start with "application/json"',
  json: 'the body payload is not a valid JSON',
  jsonEmpty:
    'the JSON body payload cannot be empty if the "Content-Type" header is set',
  array: 'must be an array',
  defaultValue: 'must be a string',
  ipv4: 'must be a valid IPv4',
  ipv6: 'must be a valid IPv6',
  date: 'must be a valid ISO 8601 / RFC 3339 date (example: 2018-07-06)',
  time: 'must be a valid ISO 8601 / RFC 3339 time (example: 12:34:56)',
  dateTime:
    'must be a valid ISO 8601 / RFC 3339 timestamp (example: 2018-07-06T12:34:56Z)',
  uri: 'must be a valid URI',
  noMessage: 'must match format "noMessage" (format)',
  'needs-quotes': 'must be a valid number',
  uniqueItems: 'must not have duplicate items (items ## 0 and 1 are identical)'
}

describe('utils/route.validation.utils', () => {
  describe('convertValidationErrors', () => {
    describe.each(['headers', 'body', 'query', 'params'])(
      'with request.%s values',
      type => {
        it('works', () => {
          const validate = ajv.compile(schema)
          expect(validate(data)).toBe(false)

          const expected = {
            [type]: expectedErrors
          }

          expect(
            convertValidationErrors(
              type as RequestSection,
              data,
              validate.errors as SortValidationResult[]
            )
          ).toEqual(expected)
        })
      }
    )
  })

  describe('niceJoin', () => {
    it('works', () => {
      expect(niceJoin([])).toBe('')
      expect(niceJoin(['a'])).toBe('a')
      expect(niceJoin(['b', 'c'], '@')).toBe('b@c')
      expect(niceJoin(['b', 'c', 'd'])).toBe('b, c and d')
    })
  })
})
