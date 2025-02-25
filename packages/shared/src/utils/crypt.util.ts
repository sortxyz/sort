/**
 * Webcrypto based encryption/decryption with AES-256-GCM following NIST recommendations.
 *
 * https://csrc.nist.gov/pubs/sp/800/38/d/final
 *
 * The encrypted text is base64 encoded to fit within text based database columns.
 *
 * Encrypted format:
 * +--------------------+-------------------------------------+---------------------+----------------+
 * | Salt               | Initialization Vector (IV)          | Iterations          | Payload        |
 * | Used to derive key | AES GCM                             | For key generation  | Encrypted Data |
 * | 64 bytes, random   | 12 bytes (96 bits) random, per NIST | 4 bytes             | N bytes        |
 * +--------------------+-------------------------------------+---------------------|----------------+
 *
 * The following environment variable is used to derive a CryptoKey for
 * encryption/decryption, this env var MUST be set or the process will exit with
 * an error:
 *   DB_FIELD_ENCRYPTION_KEY
 *
 * NOTE: Do not change the IV size. This IV size is the strong recommendation per NIST.
 * NOTE: Changing the DB_FIELD_ENCRYPTION_KEY, salt size or IV size means we
 *       cannot decrypt any previously encrypted data. Plan accordingly.
 * NOTE: It is OK to change the number of iterations because we store this value
 *       in the ciphertext and reuse it during decryption.
 * NOTE: With AES-GCM it is important the IV not be reused with the same key. To
 *       ensure this requirement we generate a random IV and unique key per encrypted
 *       value.
 */
import * as assert from 'node:assert'
import { webcrypto } from 'node:crypto'

import { getConfig } from '../config'

const getEncryptionKey = () => {
  const key = getConfig()?.IS_TEST_ENV
    ? 'AIEVXVpAJQv3TW04k79A6Q+hT7F5v+MLrl0FcsNF4cT/yukOXjOVetpf'
    : getConfig()?.DB_FIELD_ENCRYPTION_KEY

  assert.ok(key && key.length, 'DB_FIELD_ENCRYPTION_KEY env var is required.')

  assert.ok(
    !/^\s|\s$/.test(key),
    'DB_FIELD_ENCRYPTION_KEY env var must not start or end with whitespace.'
  )

  return key
}

const ivByteLength = 12
const saltByteLength = 64

const iterations = (() => {
  const count = 2023
  return {
    defaultValue: count,
    defaultBuffer: new Uint32Array([count]).buffer,
    fromBuffer: (buf: Buffer) => {
      return new Uint32Array(
        buf.buffer,
        buf.byteOffset,
        buf.byteLength / Uint32Array.BYTES_PER_ELEMENT
      )[0]
    }
  }
})()

let keyMaterial: webcrypto.CryptoKey
/**
 * Returns a webcrypto.CryptoKey created from the `DB_FIELD_ENCRYPTION_KEY` env
 * variable.
 */
const getBaseKey = async () => {
  if (keyMaterial) return keyMaterial

  keyMaterial = await webcrypto.subtle.importKey(
    'raw',
    Buffer.from(getEncryptionKey()),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  return keyMaterial
}

/**
 * Encrypts the given `plaintext` and returns it's base64 encoded string.
 */
export const encrypt = async (plaintext: string) => {
  try {
    const iv = createIv()
    const salt = createSalt()
    const key = await deriveKey(salt, iterations.defaultValue)
    const ciphertext = await webcrypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      Buffer.from(plaintext)
    )

    const result = toUint8Array(salt, iv, iterations.defaultBuffer, ciphertext)
    return Buffer.from(result).toString('base64')
  } catch (cause) {
    throw new Error('Failed to encrypt value.', { cause })
  }
}

/**
 * Decrypts and returns the given `ciphertext` string.
 */
export const decrypt = async (ciphertext: string) => {
  try {
    const buf = Buffer.from(ciphertext, 'base64')

    const saltStart = 0
    const saltEnd = saltByteLength
    const ivStart = saltEnd
    const ivEnd = ivStart + ivByteLength
    const iterStart = ivEnd
    const iterEnd = iterStart + iterations.defaultBuffer.byteLength
    const valStart = iterEnd

    const salt = buf.subarray(saltStart, saltEnd)
    const iv = buf.subarray(ivStart, ivEnd)
    const iter = buf.subarray(iterStart, iterEnd)
    const val = buf.subarray(valStart)
    const key = await deriveKey(salt, iterations.fromBuffer(iter))

    const decrypted = await webcrypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      val
    )
    return Buffer.from(decrypted).toString('utf8')
  } catch (cause) {
    throw new Error('Failed to decrypt value.', { cause })
  }
}

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey
 */
const deriveKey = async (salt: Uint8Array, iterations: number) => {
  const baseKey = await getBaseKey()
  const derivedKeySettings = { name: 'AES-GCM', length: 256 }
  const algorithm = {
    name: 'PBKDF2',
    hash: 'SHA-512',
    salt,
    iterations
  }

  const key = await webcrypto.subtle.deriveKey(
    algorithm,
    baseKey,
    derivedKeySettings,
    false,
    ['encrypt', 'decrypt']
  )
  return key
}

/**
 * Combines a list of Uint8Arrays and ArrayBuffers into a single Uint8Array.
 */
const toUint8Array = (...bufs: (Uint8Array | ArrayBuffer)[]) => {
  const length = bufs.reduce((acc, buf) => acc + buf.byteLength, 0)
  const result = new Uint8Array(length)

  let offset = 0

  return bufs.reduce((acc: Uint8Array, buf) => {
    const val = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
    acc.set(val, offset)
    offset += val.byteLength
    return acc
  }, result)
}

const createIv = () => {
  return webcrypto.getRandomValues(new Uint8Array(ivByteLength))
}

const createSalt = () => {
  return webcrypto.getRandomValues(new Uint8Array(saltByteLength))
}

/**
 * An encrypted database field abstraction.
 * @example const field = EncryptedField.fromEncryptedValue('ab3D2hg9nqogwj4I0Nh24f3j0ahcd')
 * @example const field = EncryptedField.fromDecryptedValue('some string')
 */
export class EncryptedField {
  #encryptedValue: string | null
  #decryptedValue: string | null

  constructor(value: string, options: { isEncrypted: boolean }) {
    this.#encryptedValue = options.isEncrypted ? value : null
    this.#decryptedValue = options.isEncrypted ? null : value
  }

  async encrypt() {
    if (this.#encryptedValue) {
      return this.#encryptedValue
    }

    if (!this.#decryptedValue) {
      throw new Error('Cannot encrypt empty value.')
    }

    this.#encryptedValue = await encrypt(this.#decryptedValue)
    return this.#encryptedValue
  }

  async decrypt() {
    if (this.#decryptedValue) {
      return this.#decryptedValue
    }

    if (!this.#encryptedValue) {
      throw new Error('Cannot decrypt empty value.')
    }

    this.#decryptedValue = await decrypt(this.#encryptedValue)
    return this.#decryptedValue
  }

  /** Constructs an instance of EncryptedField initialized with an encrypted value. */
  static fromEncryptedValue(value: string) {
    return new EncryptedField(value, { isEncrypted: true })
  }

  /** Constructs an instance of EncryptedField initialized with a decrypted value. */
  static fromDecryptedValue(value: string) {
    return new EncryptedField(value, { isEncrypted: false })
  }
}
