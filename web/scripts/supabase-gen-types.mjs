import { spawn } from "node:child_process";
import { createWriteStream, readFileSync } from "node:fs";
import { resolve } from "node:path";

const env = {
  ...readDotEnv(resolve(process.cwd(), ".env")),
  ...process.env
};

const supabaseUrl = env.VITE_SUPABASE_URL;
const accessToken = env.SUPABASE_ACCESS_TOKEN;

if (!supabaseUrl) {
  fail("VITE_SUPABASE_URL is required in web/.env or the environment.");
}

if (!accessToken) {
  fail("SUPABASE_ACCESS_TOKEN is required to generate live Supabase database types.");
}

const projectId = new URL(supabaseUrl).hostname.split(".")[0];
const outputPath = resolve(process.cwd(), "src/database.types.ts");
const output = createWriteStream(outputPath);
const cli = env.SUPABASE_CLI_BIN || "supabase";

const child = spawn(
  cli,
  ["gen", "types", "typescript", "--project-id", projectId, "--schema", "public"],
  {
    env: {
      ...process.env,
      SUPABASE_ACCESS_TOKEN: accessToken
    },
    stdio: ["ignore", "pipe", "inherit"]
  }
);

child.stdout.pipe(output);

child.on("close", (code) => {
  output.close();
  if (code !== 0) {
    fail(`Supabase type generation failed with exit code ${code}.`);
  }
  console.log(`Wrote ${outputPath}`);
});

function readDotEnv(filePath) {
  try {
    return Object.fromEntries(
      readFileSync(filePath, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const index = line.indexOf("=");
          if (index === -1) return [line, ""];
          return [line.slice(0, index), line.slice(index + 1)];
        })
    );
  } catch {
    return {};
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
