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
  "lead.created": {
    leadId: string
    userId: string
  }
  "lead.updated": {
    leadId: string
    userId: string
    changedFields: string[]
  }
  "lead.deleted": {
    leadId: string
    userId: string
  }
  "lead.stage_changed": {
    leadId: string
    userId: string
    from: string
    to: string
  }
  "lead.converted": {
    leadId: string
    userId: string
    clientId: string
  }
  "project.created": {
    projectId: string
    userId: string
  }
  "project.updated": {
    projectId: string
    userId: string
    changedFields: string[]
  }
  "project.deleted": {
    projectId: string
    userId: string
  }
  "project.status_changed": {
    projectId: string
    userId: string
    from: string
    to: string
  }
  "task.created": {
    taskId: string
    projectId: string
    userId: string
  }
  "task.updated": {
    taskId: string
    projectId: string
    userId: string
    changedFields: string[]
  }
  "task.deleted": {
    taskId: string
    projectId: string
    userId: string
  }
  "task.status_changed": {
    taskId: string
    projectId: string
    userId: string
    from: string
    to: string
  }
  "proposal.created": {
    proposalId: string
    projectId: string
    userId: string
  }
  "proposal.updated": {
    proposalId: string
    projectId: string
    userId: string
    changedFields: string[]
  }
  "proposal.sent": {
    proposalId: string
    projectId: string
    userId: string
  }
  "proposal.deleted": {
    proposalId: string
    projectId: string
    userId: string
  }
  "template.created": {
    templateId: string
    userId: string
  }
  "template.updated": {
    templateId: string
    userId: string
    changedFields: string[]
  }
  "template.deleted": {
    templateId: string
    userId: string
  }
}
