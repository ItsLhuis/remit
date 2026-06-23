"use client"

import { useMemo } from "react"

import { useTranslation } from "@/lib/i18n"

import { cn } from "@/lib/utils"

import { Icon, Typography } from "@/components/ui"

import { passwordRules } from "../schemas"

const STRENGTH_SEGMENTS = 5

function getStrengthLabelKey(score: number) {
  if (score <= 0) return "auth.register.passwordStrengthEmpty"
  if (score <= 2) return "auth.register.passwordStrengthWeak"
  if (score === 3) return "auth.register.passwordStrengthMedium"
  if (score === 4) return "auth.register.passwordStrengthStrong"
  return "auth.register.passwordStrengthVeryStrong"
}

function getStrengthColor(score: number) {
  if (score <= 2) return "bg-destructive"
  if (score <= 4) return "bg-warning-border"
  return "bg-success-border"
}

type PasswordRequirementsProps = {
  password: string
}

const PasswordRequirements = ({ password }: PasswordRequirementsProps) => {
  const { t } = useTranslation()

  const passwordChecks = useMemo(
    () => [
      {
        label: t("auth.register.passwordMinLength", { count: passwordRules.minLength }),
        valid: password.length >= passwordRules.minLength
      },
      {
        label: t("auth.register.passwordLowercase"),
        valid: passwordRules.hasLowercase.test(password)
      },
      {
        label: t("auth.register.passwordUppercase"),
        valid: passwordRules.hasUppercase.test(password)
      },
      { label: t("auth.register.passwordNumber"), valid: passwordRules.hasNumber.test(password) },
      {
        label: t("auth.register.passwordSpecial"),
        valid: passwordRules.hasSpecialChar.test(password)
      }
    ],
    [password, t]
  )

  const score = passwordChecks.filter((check) => check.valid).length

  return (
    <div className="mt-1 flex flex-col gap-2">
      <div aria-hidden="true" className="flex items-center gap-1.5">
        {Array.from({ length: STRENGTH_SEGMENTS }, (_, index) => (
          <span
            key={index}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              index < score ? getStrengthColor(score) : "bg-muted"
            )}
          />
        ))}
      </div>
      <Typography affects="small" aria-live="polite" className="text-foreground font-medium">
        {t(getStrengthLabelKey(score))}
      </Typography>
      <div className="flex flex-col gap-1.5">
        {passwordChecks.map((check) => (
          <div key={check.label} className="flex items-center gap-2">
            <Icon
              name={check.valid ? "Check" : "X"}
              aria-hidden="true"
              className={cn(
                "size-4 shrink-0",
                check.valid ? "text-success-border" : "text-muted-foreground"
              )}
            />
            <Typography
              affects="small"
              className={check.valid ? "text-success-foreground" : "text-muted-foreground"}
            >
              {check.label}
            </Typography>
          </div>
        ))}
      </div>
    </div>
  )
}

export { PasswordRequirements }
