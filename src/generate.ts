import { LOCAL_MODELS, STARTING_QUESTIONS, TOP_HF_REPOS } from "./constants.ts";
import { readAgentModels } from "./lib/remote-models.ts";
import { pick, promisesQueue } from "./lib/utils.ts";
import { runSession } from "./single-session.ts";

const BATCH_SIZE = Number(process.env.BATCH_SIZE) || 100;
const CONCURRENCY = Number(process.env.CONCURRENCY) || 20;
// Per-session straggler cutoff: a session that runs longer than this frees its
// concurrency slot so it can't hold up the rest of the batch.
const SESSION_TIMEOUT_MS = Number(process.env.SESSION_TIMEOUT_MS) || 10 * 60 * 1000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(new Error(`session timed out after ${Math.round(ms / 1000)}s`));
		}, ms);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error) => {
				clearTimeout(timer);
				reject(error);
			},
		);
	});
}

await (async () => {
	const agentModels = await readAgentModels();

	await promisesQueue(
		Array.from({ length: BATCH_SIZE }),
		async (_task, index) => {
			const taskNumber = index + 1;
			console.log(`task ${taskNumber}/${BATCH_SIZE} started`);
			try {
				const repo = pick(TOP_HF_REPOS);
				const sessionFile = await withTimeout(
					runSession({
						agentModelId: pick(agentModels),
						userModelId: pick([...LOCAL_MODELS[0]]),
						repo,
						startingPrompt: `${repo}: ${pick(STARTING_QUESTIONS)}`,
					}),
					SESSION_TIMEOUT_MS,
				);
				console.log(`task ${taskNumber}/${BATCH_SIZE} completed — ${sessionFile}`);
			} catch (error) {
				console.error(`task ${taskNumber}/${BATCH_SIZE} failed — ${(error as Error).message}`);
			}
		},
		CONCURRENCY,
	);
})();
