export function FormValidationErrorInner({ error }: { error: string }) {
  return <li className="text-red-600">{error}</li>;
}
