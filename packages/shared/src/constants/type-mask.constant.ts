export const dateFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/

export const uuidFormat =
  /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/

export const apiKeyFormat = /^(?=.{10,128}$)[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/
