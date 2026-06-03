import { LOCAL_MODELS, STARTING_QUESTIONS, TOP_HF_REPOS } from "./constants.ts";
import { readAgentModels } from "./lib/remote-models.ts";
import { pick, promisesQueue } from "./lib/utils.ts";
import { runSession } from "./single-session.ts";

const BATCH_SIZE = Number(process.env.BATCH_SIZE) || 100;
const CONCURRENCY = 20;

await (async () => {
	const agentModels = await readAgentModels();

	await promisesQueue(
		Array.from({ length: BATCH_SIZE }),
		async (_task, index) => {
			const taskNumber = index + 1;
			console.log(`task ${taskNumber}/${BATCH_SIZE} started`);
			try {
				const repo = pick(TOP_HF_REPOS);
				const sessionFile = await runSession({
					agentModelId: pick(agentModels),
					userModelId: pick(LOCAL_MODELS),
					repo,
					startingPrompt: `${repo}: ${pick(STARTING_QUESTIONS)}`,
				});
				console.log(`task ${taskNumber}/${BATCH_SIZE} completed — ${sessionFile}`);
			} catch (error) {
				console.error(`task ${taskNumber}/${BATCH_SIZE} failed — ${(error as Error).message}`);
			}
		},
		CONCURRENCY,
	);
})();
