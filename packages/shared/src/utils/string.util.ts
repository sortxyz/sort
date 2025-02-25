import markdownit from 'markdown-it'

export const uuidRegExp =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/

/**
 * A RegExp which matches a ISO8601 date string format.
 */
export const iso8601RegExp =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/

export const hydrateSQLString = (
  sql: string,
  params: ReadonlyArray<unknown>
) => {
  let index = 0
  return sql.replace(/\$[\d]+/g, (_match: string, ..._args: unknown[]) => {
    const value = String(params[index++])
    return value
  })
}

export const mdToHtml = async (markdown: string) => {
  const convert = markdownit({
    breaks: true,
    linkify: true,
    html: true
  })

  return convert.renderInline(markdown)
}

export const capitalizeWord = (str: string) =>
  str.charAt(0).toUpperCase() + str.slice(1)
