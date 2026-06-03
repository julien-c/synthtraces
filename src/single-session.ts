import {
	AuthStorage,
	createAgentSession,
	DefaultResourceLoader,
	getAgentDir,
	ModelRegistry,
	SessionManager,
	SettingsManager,
} from "@earendil-works/pi-coding-agent";
import path from "node:path";
import { PATH_OUTPUT_DATASET } from "./constants.ts";

/** The coding agent is served by the Hugging Face router, authenticated via `HF_TOKEN`. */
const AGENT_PROVIDER = "huggingface";

/** Remotely hosted open model backing the coding agent (hardcoded for now). */
const AGENT_MODEL_ID = "deepseek-ai/DeepSeek-V4-Pro";

/** Default Pi coding-agent tools. */
const AGENT_TOOLS = ["read", "write", "edit", "bash"];

await (async () => {
	if (!process.env.HF_TOKEN) {
		throw new Error("HF_TOKEN is not set — required to reach the Hugging Face provider.");
	}

	const cwd = process.cwd();
	const authStorage = AuthStorage.create();
	const modelRegistry = ModelRegistry.create(authStorage);
	const model = modelRegistry.find(AGENT_PROVIDER, AGENT_MODEL_ID);
	if (!model) {
		throw new Error(`Model ${AGENT_PROVIDER}/${AGENT_MODEL_ID} not found in the model registry.`);
	}

	const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false } });

	// Empty resource loader: discover nothing from the machine — no extensions, skills,
	// prompts, themes, context files, or custom system prompt — so the session runs
	// against pi's default coding-agent prompt and is reproducible.
	const resourceLoader = new DefaultResourceLoader({
		cwd,
		agentDir: getAgentDir(),
		noExtensions: true,
		noSkills: true,
		noPromptTemplates: true,
		noThemes: true,
		noContextFiles: true,
		systemPromptOverride: () => undefined,
		appendSystemPromptOverride: () => [],
	});
	await resourceLoader.reload();

	const { session } = await createAgentSession({
		cwd,
		model,
		authStorage,
		modelRegistry,
		settingsManager,
		tools: AGENT_TOOLS,
		resourceLoader,
		sessionManager: SessionManager.create(cwd, path.join(PATH_OUTPUT_DATASET, "sessions")),
	});

	// Stream the agent's reply to stdout.
	session.subscribe((event) => {
		if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
			process.stdout.write(event.assistantMessageEvent.delta);
		}
	});

	await session.prompt("What are the main characteristics of this codebase?");

	console.log(`\n\nTrace saved to ${session.sessionFile}`);
	session.dispose();
})();
