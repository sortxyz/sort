import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const getAppVersion = ({ directory }: { directory: string }) => {
  try {
    const pkgPath = resolve(directory, 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    return `${pkg.name}@${pkg.version}`
  } catch (err) {
    if ((err as Error & { code: string }).code !== 'ENOENT') throw err
  }

  return 'unknown'
}
