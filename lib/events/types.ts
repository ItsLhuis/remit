export type EventMap = {
  "auth.login.succeeded": {
    userId: string
    ipAddress: string
    userAgent: string
  }
  "auth.login.failed": {
    email: string
    ipAddress: string
    userAgent: string
  }
  "auth.password.changed": {
    userId: string
    ipAddress: string
    userAgent: string
  }
  "auth.totp.reconfigured": {
    userId: string
    ipAddress: string
    userAgent: string
  }
  "auth.backup_code.consumed": {
    userId: string
    ipAddress: string
    userAgent: string
  }
  "settings.email.configured": {
    userId: string
  }
  "settings.payment.configured": {
    userId: string
  }
  "settings.security.changed": {
    userId: string
    field: string
  }
  "client.created": {
    clientId: string
    userId: string
  }
  "client.updated": {
    clientId: string
    userId: string
    changedFields: string[]
  }
  "client.deleted": {
    clientId: string
    userId: string
  }
}
