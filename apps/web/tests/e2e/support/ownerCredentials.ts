// The canonical auth spec registers this account on an instance that has no owner yet, and
// `ownerProvisioning.ts` finishes its TOTP enrolment with the same password. Both sides must agree
// on the password or provisioning cannot call Better Auth's `enableTwoFactor`, which re-checks the
// credential password. An instance that already has an owner (a local dev database) keeps its own
// account and neither of those steps runs.
export const E2E_OWNER_PASSWORD = "TestPassword123!"
