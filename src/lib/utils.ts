/**
 * Map over `items` running `worker` with at most `concurrency` tasks in flight.
 * Results are returned in the same order as `items`.
 */
export async function promisesQueue<T, R>(
	items: readonly T[],
	worker: (item: T, index: number) => Promise<R>,
	concurrency: number,
): Promise<R[]> {
	const results: R[] = Array.from({ length: items.length });
	let next = 0;

	async function run(): Promise<void> {
		while (next < items.length) {
			const index = next++;
			results[index] = await worker(items[index], index);
		}
	}

	const pool = Array.from({ length: Math.min(concurrency, items.length) }, run);
	await Promise.all(pool);

	return results;
}
