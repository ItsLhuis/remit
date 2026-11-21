const ONBOARDING_TOTAL_STEPS = 5

const ONBOARDING_STEPS = {
  account: 1,
  businessProfile: 2,
  totpEnable: 3,
  totpVerify: 4,
  recoveryCodes: 5
} as const

export { ONBOARDING_STEPS, ONBOARDING_TOTAL_STEPS }
