export async function mapWithConcurrency<Input, Output>(
  items: readonly Input[],
  limit: number,
  mapper: (item: Input) => Promise<Output>
): Promise<Output[]> {
  const results: Output[] = new Array(items.length)
  const queue = items.map((item, index) => ({ index, item }))
  let cursor = 0

  async function worker(): Promise<void> {
    while (cursor < queue.length) {
      const current = queue[cursor]
      cursor += 1
      if (!current) return

      results[current.index] = await mapper(current.item)
    }
  }

  const workerCount = Math.min(Math.max(limit, 1), queue.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))

  return results
}
