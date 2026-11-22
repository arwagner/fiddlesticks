// A Fisher–Yates shuffle that takes its random numbers from the caller, so a test can repeat a deal exactly.
export function shuffled<T>(values: readonly T[], random: () => number = Math.random): T[] {
  const next = [...values]

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    const current = next[index]
    next[index] = next[swap]
    next[swap] = current
  }

  return next
}
