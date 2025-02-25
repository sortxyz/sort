import { randomUUID } from 'node:crypto'

import { Type } from '@sinclair/typebox'
import { configure } from '@sort/config'

configure({ directory: '.', schema: Type.Object({}) })

import { encrypt, decrypt, EncryptedField } from './crypt.util'

describe('crypt util', () => {
  describe('#encrypt and #decrypt', () => {
    it('perform correctly', async () => {
      const txt = `postgres://user:${randomUUID()}@localhost:5432/dbname?cool=1`
      const enc1 = await encrypt(txt)
      const dec1 = await decrypt(enc1)
      expect(txt).toEqual(dec1)
      const enc2 = await encrypt(dec1)
      const dec2 = await decrypt(enc2)
      expect(txt).toEqual(dec2)
    })
  })

  describe('EncryptedField', () => {
    describe('fromEncryptedValue', () => {
      it('returns an instance of EncryptedField', () => {
        const field = EncryptedField.fromEncryptedValue('abcd')
        expect(field instanceof EncryptedField).toBe(true)
      })
    })

    describe('fromDecryptedValue', () => {
      it('returns an instance of EncryptedField', () => {
        const field = EncryptedField.fromDecryptedValue('testing')
        expect(field instanceof EncryptedField).toBe(true)
      })
    })

    it('encrypts and decrypts correctly', async () => {
      const value = 'testing'
      const fieldA = EncryptedField.fromDecryptedValue(value)

      expect(await fieldA.decrypt()).toEqual(value)
      const encryptedValue = await fieldA.encrypt()
      expect(encryptedValue).not.toEqual(value)

      const fieldB = EncryptedField.fromEncryptedValue(encryptedValue)
      expect(await fieldB.encrypt()).toEqual(encryptedValue)
      const decryptedValue = await fieldB.decrypt()
      expect(decryptedValue).not.toEqual(encryptedValue)
      expect(decryptedValue).toEqual(value)
    })

    describe('#decrypt', () => {
      it('throws if value is empty', async () => {
        const value = ''
        const fieldA = EncryptedField.fromEncryptedValue(value)
        await expect(fieldA.decrypt()).rejects.toThrowError(
          'Cannot decrypt empty value.'
        )
      })

      it('throws if value is not encrypted', async () => {
        const value = 'BEEF'
        const fieldA = EncryptedField.fromEncryptedValue(value)
        await expect(fieldA.decrypt()).rejects.toThrowError()
      })
    })

    describe('#encrypt', () => {
      it('throws if value is empty', async () => {
        const value = ''
        const fieldA = EncryptedField.fromDecryptedValue(value)
        await expect(fieldA.encrypt()).rejects.toThrowError(
          'Cannot encrypt empty value.'
        )
      })
    })
  })
})
