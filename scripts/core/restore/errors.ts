export class RestoreCliError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly auditEligible: boolean = true
  ) {
    super(message)
  }
}
