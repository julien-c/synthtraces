import { readFile } from "node:fs/promises";
import { REMOTE_MODELS_FILE } from "../constants.ts";

/**
 * Read the remotely hosted agent model IDs from the generated `remote-models.md` table
 * (the output of `npm run pick-remote-models`). Throws if none are found.
 */
export async function readAgentModels(): Promise<string[]> {
	const table = await readFile(REMOTE_MODELS_FILE, "utf8");
	const models: string[] = [];
	for (const match of table.matchAll(/^\|\s*\d+\s*\|\s*`([^`]+)`/gm)) {
		if (match[1]) {
			models.push(match[1]);
		}
	}
	if (models.length === 0) {
		throw new Error(
			`No agent models in ${REMOTE_MODELS_FILE} — run \`npm run pick-remote-models\` first.`,
		);
	}
	return models;
}
