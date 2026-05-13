"use client"

import { useMemo } from "react"

import { useTranslation } from "@/lib/i18n"

import { passwordRules } from "../schemas"

import { Icon, Progress, Typography } from "@/components/ui"

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
        label: t("auth.register.passwordUppercase"),
        valid: passwordRules.hasUppercase.test(password)
      },
      {
        label: t("auth.register.passwordLowercase"),
        valid: passwordRules.hasLowercase.test(password)
      },
      { label: t("auth.register.passwordNumber"), valid: passwordRules.hasNumber.test(password) },
      {
        label: t("auth.register.passwordSpecial"),
        valid: passwordRules.hasSpecialChar.test(password)
      }
    ],
    [password, t]
  )
  const passedChecks = passwordChecks.filter((check) => check.valid).length

  return (
    <div className="dark:bg-input/30 mt-2 rounded-md border p-3">
      <div className="mb-2 flex items-center justify-between">
        <Typography affects="tiny">{t("auth.register.passwordRequirements")}</Typography>
        <Typography affects="tiny" className="text-foreground font-medium">
          {passedChecks}/{passwordChecks.length}
        </Typography>
      </div>
      <Progress
        className="mb-3"
        value={(passedChecks / passwordChecks.length) * 100}
        aria-label={t("auth.register.passwordRequirementsProgress")}
      />
      <div className="space-y-1">
        {passwordChecks.map((check) => (
          <div key={check.label} className="flex items-center gap-2 rounded-sm px-1 py-0.5">
            <Icon
              name={check.valid ? "CheckCircle2" : "Circle"}
              className={check.valid ? "text-success-foreground" : "text-muted-foreground"}
            />
            <Typography
              affects="tiny"
              className={check.valid ? "text-foreground" : "text-muted-foreground"}
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
