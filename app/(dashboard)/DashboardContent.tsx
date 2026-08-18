import { DashboardPage } from "@/features/dashboard"
import { getDashboardPageData } from "@/features/dashboard/server"

type DashboardContentProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

// The promise is passed in unawaited rather than resolved in the route: awaiting it there would
// suspend the shell too, and the point of the boundary is that the header renders first.
const DashboardContent = async ({ searchParams }: DashboardContentProps) => {
  const data = await getDashboardPageData(await searchParams)

  return <DashboardPage data={data} />
}

export { DashboardContent }
