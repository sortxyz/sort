import fs from 'node:fs'
import path from 'node:path'

const files = fs.readdirSync(__dirname)

export const descriptions = new Map()

for (const file of files) {
  if (!file.endsWith('.md')) continue
  const filePath = path.join(__dirname, file)
  const data = fs.readFileSync(filePath, 'utf8')
  const key = path.basename(file, '.md')
  descriptions.set(key, data.trim())
}
