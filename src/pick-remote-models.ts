import { writeFile } from "node:fs/promises";
import { N_REMOTE_MODELS, REMOTE_MODELS_FILE } from "./constants.ts";

const ROUTER_MODELS_URL = "https://router.huggingface.co/v1/models";

interface Provider {
	provider: string;
	status: string;
}

interface Model {
	id: string;
	providers: Provider[];
}

interface ModelsResponse {
	data: Model[];
}

await (async () => {
	const res = await fetch(ROUTER_MODELS_URL);
	if (!res.ok) {
		throw new Error(`${ROUTER_MODELS_URL} responded with ${res.status} ${res.statusText}`);
	}
	const { data } = (await res.json()) as ModelsResponse;

	const picked: [string, string][] = [];
	for (const model of data) {
		const live = model.providers.find((p) => p.status === "live");
		if (!live) {
			continue;
		}
		picked.push([model.id, live.provider]);
		if (picked.length === N_REMOTE_MODELS) {
			break;
		}
	}

	const table = [
		"| # | Model | Provider |",
		"| --- | --- | --- |",
		...picked.map(([model, provider], i) => `| ${i + 1} | \`${model}\` | ${provider} |`),
	].join("\n");
	await writeFile(REMOTE_MODELS_FILE, `${table}\n`);
	console.log(`✓ wrote ${picked.length} [model, provider] pairs to ${REMOTE_MODELS_FILE}`);
})();
