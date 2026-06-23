"use client"

import { type ComponentProps, useState } from "react"

import { useTranslation } from "@/lib/i18n"

import { Icon } from "@/components/ui/Icon"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from "@/components/ui/InputGroup"

type PasswordInputProps = Omit<ComponentProps<"input">, "type">

const PasswordInput = ({ className, disabled, ...props }: PasswordInputProps) => {
  const { t } = useTranslation()

  const [isVisible, setIsVisible] = useState(false)

  return (
    <InputGroup data-slot="password-input" className={className}>
      <InputGroupInput {...props} type={isVisible ? "text" : "password"} disabled={disabled} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          aria-label={
            isVisible ? t("common.actions.hidePassword") : t("common.actions.showPassword")
          }
          aria-pressed={isVisible}
          disabled={disabled}
          onClick={() => setIsVisible((previous) => !previous)}
        >
          <Icon name={isVisible ? "EyeOff" : "Eye"} aria-hidden="true" />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}

export { PasswordInput }
