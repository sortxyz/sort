export const toServerErrorMessage = (
  id: string,
  message = 'Internal server error.'
) => {
  const help = `If the problem persists, please contact support and include the following id: ${id}`

  return `${message} ${help}`
}
