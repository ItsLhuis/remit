import { formatCentsForInput } from "@/lib/utils"

import { type ProjectDetail, type ProjectFormData } from "../types"

function toDateInput(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : ""
}

export function toProjectFormData(project: ProjectDetail): ProjectFormData {
  return {
    id: project.id,
    clientId: project.clientId,
    name: project.name,
    budget: formatCentsForInput(project.budgetCents),
    hourlyRate: formatCentsForInput(project.hourlyRateCents),
    startDate: toDateInput(project.startDate),
    endDate: toDateInput(project.endDate),
    description: project.description
  }
}
