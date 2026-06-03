import path from "node:path";

/** Base URL of the local llama.cpp OpenAI-compatible server. */
export const LLAMA_BASE_URL = process.env.LLAMA_BASE_URL ?? "http://localhost:8080/v1";

/** Local models served via llama.cpp. */
export const LOCAL_MODELS: string[] = [
	"ggml-org/Qwen3.6-27B-GGUF:Q8_0",
	"ggml-org/Qwen3.6-35B-A3B-MTP-GGUF:Q8_0",
	"ggml-org/gemma-4-26B-A4B-it-GGUF:Q8_0",
];

/** Where cloned source repos live. */
export const PATH_REPOS = path.resolve("repos");

/** Where generated synthetic-trace datasets are written. */
export const PATH_OUTPUT_DATASET = path.resolve("dataset");

/** Where session traces are written, inside the dataset repo. */
export const PATH_SESSIONS = path.join(PATH_OUTPUT_DATASET, "sessions");

/** Number of remote models to pick from the HF router. */
export const N_REMOTE_MODELS = 20;

/** Path of the generated model/provider table. */
export const REMOTE_MODELS_FILE = path.resolve("remote-models.md");

/** Maximum number of agent turns per session. */
export const MAX_NUMBER_OF_TURNS_PER_SESSION = 5;

/** Project codebases the agent is harnessed on (cloned into {@link PATH_REPOS}). */
export const TOP_HF_REPOS = [
	"transformers",
	"pytorch-image-models",
	"diffusers",
	"smolagents",
	"open-r1",
	"lerobot",
	"datasets",
	"peft",
	"candle",
	"sentence-transformers",
	"trl",
	"transformers.js",
	"text-generation-inference",
	"tokenizers",
	"chat-ui",
	"ml-intern",
	"accelerate",
	"parler-tts",
	"nanoVLM",
	"speech-to-speech",
	"huggingface_hub",
	"huggingface.js",
] as const;

/** A single repo name drawn from {@link TOP_HF_REPOS}. */
export type HfRepo = (typeof TOP_HF_REPOS)[number];

/** Pool of opening questions the agent picks from to start a session. */
export const STARTING_QUESTIONS: string[] = [
	"How do I run this code?",
	"What are the main characteristics of this codebase?",
	"How is CI set up in this repo?",
	"Who are the main authors of this repo?",
	"What recent changes were made and why?",
	"How do I install the dependencies and set up a dev environment?",
	"How is this project structured at a high level?",
	"How do I run the tests?",
	"What is the public API or main entry point?",
	"What license is this project released under?",
	"How do I contribute to this repository?",
	"What are the most important files to understand first?",
	"What design patterns or architecture does this codebase follow?",
	"How is configuration handled in this project?",
	"What external dependencies does this project rely on?",
	"How is logging and error handling done here?",
	"Are there any known limitations or TODOs in the code?",
	"How is documentation generated and maintained?",
	"What is the release and versioning process?",
	"How do the different modules in this repo interact?",
];
