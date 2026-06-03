import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { type HfRepo, PATH_REPOS, TOP_HF_REPOS } from "./constants.ts";
import { promisesQueue } from "./lib/utils.ts";

const MAX_CONCURRENCY = 10;

function run(cmd: string, args: string[], cwd: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(cmd, args, { cwd, stdio: "inherit" });
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
			}
		});
	});
}

async function sync(name: string): Promise<void> {
	const dest = path.join(PATH_REPOS, name);
	if (existsSync(dest)) {
		console.log(`↻ pulling ${name}`);
		await run("git", ["-C", dest, "pull", "--ff-only"], PATH_REPOS);
	} else {
		console.log(`⤓ cloning ${name}`);
		await run("git", ["clone", `https://github.com/huggingface/${name}.git`, name], PATH_REPOS);
	}
}

await (async () => {
	await mkdir(PATH_REPOS, { recursive: true });

	const results = await promisesQueue(
		TOP_HF_REPOS,
		async (name) => {
			try {
				await sync(name);
				return null;
			} catch (err) {
				console.error(`✗ ${name}: ${(err as Error).message}`);
				return name;
			}
		},
		MAX_CONCURRENCY,
	);

	const failures = results.filter((name): name is HfRepo => name !== null);
	if (failures.length > 0) {
		console.error(`\nFailed: ${failures.join(", ")}`);
		process.exit(1);
	}
	console.log(`\n✓ synced ${TOP_HF_REPOS.length} repos into ${PATH_REPOS}`);
})();
