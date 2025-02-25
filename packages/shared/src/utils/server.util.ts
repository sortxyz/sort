import { Type } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'

const ErrnoExceptionSchema = Type.Object({
  errno: Type.Optional(Type.Number()),
  code: Type.Optional(Type.String()),
  path: Type.Optional(Type.String()),
  syscall: Type.Optional(Type.String())
})

const ErrnoExceptionTypeCheck = TypeCompiler.Compile(ErrnoExceptionSchema)

export function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && ErrnoExceptionTypeCheck.Check(err)
}
