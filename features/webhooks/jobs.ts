import { registerJobHandler } from "@/lib/jobs"

import { sendWebhookDelivery } from "./delivery"

// Loaded by the worker through `scripts/core/worker/loadWorkerFeatureModules.ts`; registering here
// is what gives `webhook.delivery.send` its consumer.
registerJobHandler("webhook.delivery.send", async ({ deliveryId }) => {
  await sendWebhookDelivery(deliveryId)
})
