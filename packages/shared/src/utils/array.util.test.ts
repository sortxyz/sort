import { unsortedStringArraysEqual } from './array.util'

describe('v2/utils/array.util', () => {
  describe('unsortedStringArraysEqual()', () => {
    it('should return true for two empty arrays', () => {
      expect(unsortedStringArraysEqual([], [])).toBe(true)
    })

    it('should return true for two identical arrays', () => {
      const array = ['a', 'b', 'c']
      expect(unsortedStringArraysEqual(array, array)).toBe(true)
    })

    it('should return true for two arrays with the same elements in a different order', () => {
      const array1 = ['a', 'b', 'c']
      const array2 = ['c', 'a', 'b']
      expect(unsortedStringArraysEqual(array1, array2)).toBe(true)
    })

    it('should return false for two arrays of different lengths', () => {
      const array1 = ['a', 'b']
      const array2 = ['a', 'b', 'c']
      expect(unsortedStringArraysEqual(array1, array2)).toBe(false)
    })

    it('should return false for two arrays with the same length but different elements', () => {
      const array1 = ['a', 'b', 'c']
      const array2 = ['a', 'd', 'e']
      expect(unsortedStringArraysEqual(array1, array2)).toBe(false)
    })

    it('should return true for two arrays with the same elements including duplicates in a different order', () => {
      const array1 = ['a', 'b', 'c', 'b']
      const array2 = ['b', 'c', 'a', 'b']
      expect(unsortedStringArraysEqual(array1, array2)).toBe(true)
    })

    it('should return false for two arrays with a different number of duplicates', () => {
      const array1 = ['a', 'b', 'c', 'b']
      const array2 = ['a', 'b', 'c']
      expect(unsortedStringArraysEqual(array1, array2)).toBe(false)
    })

    it('should return false when comparing an array to itself but modified', () => {
      const array1 = ['a', 'b', 'c']
      const array2 = ['a', 'b', 'c']
      array2.push('d')
      expect(unsortedStringArraysEqual(array1, array2)).toBe(false)
    })

    it('should return false for arrays with strings differing only in case', () => {
      const array1 = ['a', 'B', 'c']
      const array2 = ['a', 'b', 'c']
      expect(unsortedStringArraysEqual(array1, array2)).toBe(false)
    })

    it('should correctly compare arrays containing strings with special characters', () => {
      const array1 = ['!', '@#$', '%^&*()']
      const array2 = ['%^&*()', '@#$', '!']
      expect(unsortedStringArraysEqual(array1, array2)).toBe(true)
    })
  })
})
