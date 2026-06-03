import {
	type AgentSession,
	AuthStorage,
	createAgentSession,
	DefaultResourceLoader,
	getAgentDir,
	ModelRegistry,
	SessionManager,
	SettingsManager,
} from "@earendil-works/pi-coding-agent";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	type HfRepo,
	LLAMA_BASE_URL,
	LOCAL_MODELS,
	MAX_NUMBER_OF_TURNS_PER_SESSION,
	PATH_REPOS,
	PATH_SESSIONS,
} from "./constants.ts";

/** The coding agent is served by the Hugging Face router, authenticated via `HF_TOKEN`. */
const AGENT_PROVIDER = "huggingface";

/** Remotely hosted open model backing the coding agent (hardcoded for now). */
const AGENT_MODEL_ID = "deepseek-ai/DeepSeek-V4-Pro";

/** Default Pi coding-agent tools. */
export const AGENT_TOOLS = ["read", "write", "edit", "bash"];

/** Read-only-ish tool set: inspect files and run commands, but no file mutations. */
const AGENT_TOOLS_READ_AND_BASH = ["read", "bash"];

/** Repo the agent operates on — one of {@link TOP_HF_REPOS}, cloned under {@link PATH_REPOS} (hardcoded for now). */
const AGENT_REPO: HfRepo = "huggingface_hub";

/** Local provider name for the llama-server, OpenAI-compatible endpoint. */
const USER_PROVIDER = "llama";

/** System prompt steering the user agent to behave like a human user asking simple questions. */
const USER_SYSTEM_PROMPT =
	"You are role-playing as a human user who is curious about a codebase but is not an expert. " +
	"Ask very simple, short questions about it, one at a time. When you receive an answer, reply " +
	"with only your next simple question — no preamble, commentary, or quotes.";

/**
 * An empty resource loader: discovers nothing from the machine — no extensions, skills,
 * prompts, themes, or context files — so sessions are reproducible. An optional
 * `systemPrompt` replaces pi's default; when omitted, pi's default prompt is used.
 */
async function createEmptyResourceLoader(
	cwd: string,
	systemPrompt?: string,
): Promise<DefaultResourceLoader> {
	const loader = new DefaultResourceLoader({
		cwd,
		agentDir: getAgentDir(),
		noExtensions: true,
		noSkills: true,
		noPromptTemplates: true,
		noThemes: true,
		noContextFiles: true,
		systemPromptOverride: () => systemPrompt,
		appendSystemPromptOverride: () => [],
	});
	await loader.reload();
	return loader;
}

/**
 * The coding agent that answers — backed by a remotely hosted open model on the Hugging
 * Face router, operating inside the given repo cloned under {@link PATH_REPOS}. Its trace
 * is persisted under `dataset/sessions/<repo>/`.
 */
export async function createRespondingAgent(modelId: string, repo: HfRepo) {
	if (!process.env.HF_TOKEN) {
		throw new Error("HF_TOKEN is not set — required to reach the Hugging Face provider.");
	}
	const cwd = path.join(PATH_REPOS, repo);
	const authStorage = AuthStorage.create();
	const modelRegistry = ModelRegistry.create(authStorage);
	const model = modelRegistry.find(AGENT_PROVIDER, modelId);
	if (!model) {
		throw new Error(`Model ${AGENT_PROVIDER}/${modelId} not found in the model registry.`);
	}

	const { session } = await createAgentSession({
		cwd,
		model,
		authStorage,
		modelRegistry,
		settingsManager: SettingsManager.inMemory({ compaction: { enabled: false } }),
		tools: AGENT_TOOLS_READ_AND_BASH,
		resourceLoader: await createEmptyResourceLoader(cwd),
		sessionManager: SessionManager.create(cwd, path.join(PATH_SESSIONS, repo)),
	});
	return session;
}

/**
 * The user agent that plays the role of the user — a barebones agent backed by a local
 * model on the llama-server ({@link LLAMA_BASE_URL}, OpenAI-compatible), with no tools,
 * an empty resource loader, and no persistence.
 */
export async function createUserAgent(modelId: string) {
	const cwd = process.cwd();
	const authStorage = AuthStorage.create();
	const modelRegistry = ModelRegistry.create(authStorage);
	modelRegistry.registerProvider(USER_PROVIDER, {
		baseUrl: LLAMA_BASE_URL,
		apiKey: "no-key", // llama-server ignores auth, but a key is required to register custom models
		api: "openai-completions",
		models: [
			{
				id: modelId,
				name: modelId,
				api: "openai-completions",
				reasoning: false,
				input: ["text"],
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				contextWindow: 32768,
				maxTokens: 4096,
			},
		],
	});
	const model = modelRegistry.find(USER_PROVIDER, modelId);
	if (!model) {
		throw new Error(`Local model ${USER_PROVIDER}/${modelId} not found after registration.`);
	}

	const { session } = await createAgentSession({
		cwd,
		model,
		thinkingLevel: "off",
		authStorage,
		modelRegistry,
		settingsManager: SettingsManager.inMemory({ compaction: { enabled: false } }),
		noTools: "all",
		resourceLoader: await createEmptyResourceLoader(cwd, USER_SYSTEM_PROMPT),
		sessionManager: SessionManager.inMemory(cwd),
	});
	return session;
}

/** Text of the last assistant message in a session (excludes thinking and tool calls). */
function lastAssistantText(session: AgentSession): string {
	const last = session.messages.findLast((message) => message.role === "assistant");
	if (last?.role !== "assistant") {
		return "";
	}
	return last.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("");
}

/** Inputs that define one synthetic session. */
export interface SessionParams {
	agentModelId: string;
	userModelId: string;
	repo: HfRepo;
	startingPrompt: string;
}

/**
 * Run one full conversation: the coding agent (HF router) answers; the user agent (local
 * llama-server) drives the follow-ups, for {@link MAX_NUMBER_OF_TURNS_PER_SESSION} turns.
 * Returns the path of the persisted trace. Per-turn output is shown only when `DEBUG=1`.
 */
export async function runSession({
	agentModelId,
	userModelId,
	repo,
	startingPrompt,
}: SessionParams): Promise<string | undefined> {
	const respondingSession = await createRespondingAgent(agentModelId, repo);
	const userSession = await createUserAgent(userModelId);

	const debug = process.env.DEBUG === "1";
	if (debug) {
		respondingSession.subscribe((event) => {
			if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
				process.stdout.write(event.assistantMessageEvent.delta);
			}
		});
	}

	let message = startingPrompt;
	for (let turn = 1; turn <= MAX_NUMBER_OF_TURNS_PER_SESSION; turn++) {
		if (debug) {
			console.log(`\n\n=== turn ${turn}/${MAX_NUMBER_OF_TURNS_PER_SESSION} — user:\n${message}\n`);
		}

		// The coding agent answers the user's message.
		await respondingSession.prompt(message);
		if (turn === MAX_NUMBER_OF_TURNS_PER_SESSION) {
			break;
		}

		// The user agent reacts to the answer to produce the next user message.
		await userSession.prompt(lastAssistantText(respondingSession));
		message = lastAssistantText(userSession);
	}

	const sessionFile = respondingSession.sessionFile;
	respondingSession.dispose();
	userSession.dispose();
	return sessionFile;
}

// Run a single example session only when this file is executed directly, not when imported.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const sessionFile = await runSession({
		agentModelId: AGENT_MODEL_ID,
		userModelId: LOCAL_MODELS[0],
		repo: AGENT_REPO,
		startingPrompt: "What are the main characteristics of this codebase?",
	});
	console.log(`\n\nTrace saved to ${sessionFile}`);
}
