"use client"

import { useState, useTransition } from "react"

import { useRouter } from "next/navigation"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"

import { useTranslation } from "@/lib/i18n"

import { formatCurrency } from "@/lib/utils"

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FieldError,
  FieldGroup,
  FormTextField,
  Icon,
  Spinner,
  toast,
  Typography
} from "@/components/ui"

import { useElapsedSeconds } from "../../hooks"
import { startTimer, stopTimer } from "../../mutations"
import { startTimerSchema, type StartTimerInputValues } from "../../schemas"
import {
  type RunningTimer,
  type TimeTrackingProjectOption,
  type TimeTrackingTaskOption
} from "../../types"
import { Duration } from "../Duration"
import { TimeEntryBillableField } from "../TimeEntryBillableField"
import { TimeEntryProjectField } from "../TimeEntryProjectField"
import { TimeEntryTaskField } from "../TimeEntryTaskField"

type TimerCardProps = {
  runningTimer: RunningTimer | null
  projectOptions: TimeTrackingProjectOption[]
  taskOptions: TimeTrackingTaskOption[]
  locale: string
}

const TimerCard = ({ runningTimer, projectOptions, taskOptions, locale }: TimerCardProps) => {
  const { t } = useTranslation()

  const router = useRouter()

  const [timerError, setTimerError] = useState<string | null>(null)
  const [isPending, startPending] = useTransition()

  const form = useForm<StartTimerInputValues>({
    resolver: zodResolver(startTimerSchema, {}, { raw: true }),
    mode: "onChange",
    defaultValues: {
      projectId: "",
      taskId: "",
      description: "",
      billable: true,
      hourlyRate: ""
    }
  })

  const { isValid } = form.formState

  const projectId = useWatch({ control: form.control, name: "projectId" })

  const elapsedSeconds = useElapsedSeconds(runningTimer?.startedAt ?? null)

  const availableTasks = taskOptions.filter((task) => task.projectId === projectId)

  const onStart = (values: StartTimerInputValues) => {
    if (isPending || !isValid) return

    setTimerError(null)

    startPending(async () => {
      const result = await startTimer(values)

      if ("error" in result) {
        setTimerError(result.error)

        return
      }

      form.reset()

      toast.success(t("timeTracking.timer.started"))

      router.refresh()
    })
  }

  const onStop = () => {
    if (isPending || !runningTimer) return

    setTimerError(null)

    startPending(async () => {
      const result = await stopTimer({ id: runningTimer.id })

      if ("error" in result) {
        setTimerError(result.error)

        return
      }

      toast.success(t("timeTracking.timer.stopped"))

      router.refresh()
    })
  }

  if (runningTimer) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("timeTracking.timer.runningTitle")}</CardTitle>
          <CardDescription>
            {t("timeTracking.timer.runningDescription", {
              project: runningTimer.projectName,
              task: runningTimer.taskTitle ?? t("timeTracking.fields.noTask")
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <Duration
              seconds={elapsedSeconds}
              withSeconds
              className="text-foreground text-3xl font-semibold tracking-tight"
            />
            <Typography affects={["muted", "small"]}>
              {runningTimer.description ||
                t("timeTracking.timer.rateHint", {
                  rate: formatCurrency(
                    runningTimer.hourlyRateSnapshotCents,
                    runningTimer.currency,
                    locale
                  )
                })}
            </Typography>
          </div>
          <div className="flex flex-col gap-2">
            <Button type="button" variant="destructive" onClick={onStop} disabled={isPending}>
              {isPending && <Spinner />}
              <Icon name="Square" aria-hidden="true" />
              {t("timeTracking.timer.stop")}
            </Button>
            {timerError ? <FieldError>{timerError}</FieldError> : null}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("timeTracking.timer.idleTitle")}</CardTitle>
        <CardDescription>{t("timeTracking.timer.idleDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onStart)} noValidate className="flex flex-col gap-4">
          <FieldGroup className="grid gap-4 md:grid-cols-2">
            <TimeEntryProjectField
              control={form.control}
              name="projectId"
              options={projectOptions}
              disabled={isPending}
            />
            <TimeEntryTaskField
              control={form.control}
              name="taskId"
              options={availableTasks}
              disabled={isPending}
            />
            <FormTextField
              control={form.control}
              name="description"
              label={t("timeTracking.fields.description")}
              placeholder={t("timeTracking.placeholders.description")}
              disabled={isPending}
            />
            <FormTextField
              control={form.control}
              name="hourlyRate"
              label={t("timeTracking.fields.hourlyRate")}
              placeholder={t("timeTracking.placeholders.hourlyRate")}
              inputMode="decimal"
              disabled={isPending}
            />
          </FieldGroup>
          <TimeEntryBillableField control={form.control} name="billable" disabled={isPending} />
          {timerError ? <FieldError>{timerError}</FieldError> : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={isPending || !isValid}>
              {isPending && <Spinner />}
              <Icon name="Play" aria-hidden="true" />
              {t("timeTracking.timer.start")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export { TimerCard }
