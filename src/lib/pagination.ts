// Keep each request below the Data API row cap. A stable order is required.
export async function readPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  const result: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await fetchPage(from, from + 499);
    if (error) throw new Error(error.message);
    const page = data || [];
    result.push(...page);
    if (page.length < 500) return result;
  }
}
