/**
 * Most of this file is copied from helper methods in
 * https://github.com/ShogunPanda/fastify-http-errors-enhanced/blob/6b6a91a82/
 * which is only compatible with strict ESM projects. The helpers have been modified to
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
import type { ValidationResult } from 'fastify'

export interface Validations {
  [key: string]: {
    [key: string]: string
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ValidationFormatter = (...args: any[]) => string

// Fastify validation objects differ from it's Fastify.ValidationResult interface
export interface SortValidationResult extends ValidationResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dataPath: any
  instancePath: string
}

export type RequestSection =
  | 'params'
  | 'query'
  | 'headers'
  | 'body'
  | 'response'

export function niceJoin(
  array: string[],
  lastSeparator = ' and ',
  separator = ', '
): string {
  switch (array.length) {
    case 0:
      return ''
    case 1:
      return array[0]
    case 2:
      return array.join(lastSeparator)
    default:
      return array.slice(0, -1).join(separator) + lastSeparator + array.at(-1)
  }
}

export const validationMessagesFormatters: {
  [key: string]: ValidationFormatter
} = {
  contentType: () =>
    'only JSON payloads are accepted. Please set the "Content-Type" header to start with "application/json"',
  json: () => 'the body payload is not a valid JSON',
  jsonEmpty: () =>
    'the JSON body payload cannot be empty if the "Content-Type" header is set',
  missing: () => 'is required',
  unknown: () => 'is not a valid property',
  uuid: () => 'must be a valid GUID (UUID v4)',
  timestamp: () =>
    'must be a valid ISO 8601 / RFC 3339 timestamp (example: 2018-07-06T12:34:56Z)',
  date: () => 'must be a valid ISO 8601 / RFC 3339 date (example: 2018-07-06)',
  time: () => 'must be a valid ISO 8601 / RFC 3339 time (example: 12:34:56)',
  uri: () => 'must be a valid URI',
  hostname: () => 'must be a valid hostname',
  ipv4: () => 'must be a valid IPv4',
  ipv6: () => 'must be a valid IPv6',
  paramType: type => {
    switch (type) {
      case 'integer':
        return 'must be a valid integer number'
      case 'number':
        return 'must be a valid number'
      case 'boolean':
        return 'must be a valid boolean (true or false)'
      case 'object':
        return 'must be an object'
      case 'array':
        return 'must be an array'
      default:
        return 'must be a string'
    }
  },
  presentString: () => 'must be a non-empty string',
  minimum: min => `must be a number greater than or equal to ${min}`,
  maximum: max => `must be a number less than or equal to ${max}`,
  minimumProperties(min: number): string {
    return min === 1
      ? 'cannot be an empty object'
      : `must be an object with at least ${min} properties`
  },
  maximumProperties(max: number): string {
    return max === 0
      ? 'must be an empty object'
      : `must be an object with at most ${max} properties`
  },
  minimumItems(min: number): string {
    return min === 1
      ? 'cannot be an empty array'
      : `must be an array with at least ${min} items`
  },
  maximumItems(max: number): string {
    return max === 0
      ? 'must be an empty array'
      : `must be an array with at most ${max} items`
  },
  enum: values =>
    `must be one of the following values: ${niceJoin(
      values.map((f: string) => `"${f}"`),
      ' or '
    )}`,
  pattern: pattern => `must match pattern "${pattern.replaceAll('(?:', '(')}"`,
  invalidFormat: format => `must match format "${format}" (format)`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function get<T>(target: any, path: string): T {
  const tokens = path.split('.').map(t => t.trim())

  for (const token of tokens) {
    if (typeof target === 'undefined' || target === null) {
      target = undefined
      break
    }

    const index = token.match(/^(\d+)|\[(\d+)]$/)
    target = index
      ? target[Number.parseInt(index[1] ?? index[2], 10)]
      : target[token]
  }

  return target
}

export function convertValidationErrors(
  section: RequestSection,
  data: { [key: string]: unknown },
  validationErrors: SortValidationResult[]
): Validations {
  const errors: { [key: string]: string } = {}

  for (const e of validationErrors) {
    let message = ''
    let pattern: string
    let value: string
    let reason: string

    let key = (e.dataPath ?? e.instancePath ?? '') as string

    if (/^[./]/.test(key)) {
      key = key.slice(1)
    }

    if (key.startsWith('[') && key.endsWith(']')) {
      key = key.slice(1, -1)
    }

    switch (e.keyword) {
      case 'required':
      case 'dependencies': {
        const missingProperty = e.params.missingProperty as string

        if (key && missingProperty && key !== missingProperty) {
          key = `${key}/${missingProperty}`
        } else {
          key = missingProperty
        }
        message = validationMessagesFormatters.missing()
        break
      }
      case 'additionalProperties':
        key = e.params.additionalProperty as string
        message = validationMessagesFormatters.unknown()
        break
      case 'type':
        message = validationMessagesFormatters.paramType(e.params.type)
        break
      case 'minProperties':
        message = validationMessagesFormatters.minimumProperties(e.params.limit)
        break
      case 'maxProperties':
        message = validationMessagesFormatters.maximumProperties(e.params.limit)
        break
      case 'minItems':
        message = validationMessagesFormatters.minimumItems(e.params.limit)
        break
      case 'maxItems':
        message = validationMessagesFormatters.maximumItems(e.params.limit)
        break
      case 'minimum':
        message = validationMessagesFormatters.minimum(e.params.limit)
        break
      case 'maximum':
        message = validationMessagesFormatters.maximum(e.params.limit)
        break
      case 'enum':
        message = validationMessagesFormatters.enum(e.params.allowedValues)
        break
      case 'pattern':
        pattern = e.params.pattern as string
        value = get<string>(data, key)

        message =
          pattern === '.+' && !value
            ? validationMessagesFormatters.presentString()
            : validationMessagesFormatters.pattern(e.params.pattern)

        break
      case 'format':
        reason = e.params.format as string

        // Normalize the key
        if (reason === 'date-time') {
          reason = 'timestamp'
        }

        message = (
          validationMessagesFormatters[reason] ||
          validationMessagesFormatters.invalidFormat
        )(reason)

        break
    }

    // No custom message was found, default to input one replacing the starting verb and adding some path info
    if (!message.length) {
      message = `${e.message
        ?.replace(/^should/, 'must')
        .replace(/\sNOT\s/gm, ' not ')}`
    }

    // Remove useless quotes
    if (/^["'][^.]+["']$/.test(key)) {
      key = key.slice(1, -1)
    }

    // Fix empty properties
    if (!key) {
      key = '$root'
    }

    key = key.replace(/^\//, '')

    errors[key] = message
  }

  return { [section]: errors }
}
