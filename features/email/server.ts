export {
  EmailDeliveryError,
  sendTransactionalEmail,
  type EmailDeliveryErrorCode,
  type TransactionalEmail
} from "./transactional"

export { isEmailConfigured, type EmailSettings } from "./services/isEmailConfigured"

export {
  sendDocumentEmail,
  type DocumentEmailAttachment,
  type DocumentEmailInput,
  type DocumentEmailResult
} from "./documentEmail"
