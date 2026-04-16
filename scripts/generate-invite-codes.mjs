import { createHash, randomInt } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DEFAULT_COUNT = 1000;
const DEFAULT_MAX_USES = 11;
const DEFAULT_PREFIX = "TWR";
const DEFAULT_JSON_FILENAME = "invite-codes.generated.json";
const DEFAULT_SQL_FILENAME = "invite-codes.generated.sql";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_SEGMENTS = [4, 4];

function printUsage() {
  console.log(`Usage: node scripts/generate-invite-codes.mjs [options]

Options:
  --count <number>        Number of invite codes to generate. Default: ${DEFAULT_COUNT}
  --max-uses <number>     Maximum redemptions per code. Default: ${DEFAULT_MAX_USES}
  --prefix <text>         Invite code prefix. Default: ${DEFAULT_PREFIX}
  --json-output <path>    JSON output path.
  --sql-output <path>     SQL output path.
  --help                  Show this help message.
`);
}

function parsePositiveInteger(rawValue, optionName) {
  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${optionName} must be a positive integer.`);
  }

  return parsed;
}

function sanitizePrefix(rawPrefix) {
  const prefix = rawPrefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (!prefix) {
    throw new Error("prefix must contain at least one alphanumeric character.");
  }

  return prefix;
}

function parseArgs(argv) {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDirectory, "..");
  const tempDirectory = path.join(repoRoot, "supabase", ".temp");

  const options = {
    count: DEFAULT_COUNT,
    maxUses: DEFAULT_MAX_USES,
    prefix: DEFAULT_PREFIX,
    jsonOutput: path.join(tempDirectory, DEFAULT_JSON_FILENAME),
    sqlOutput: path.join(tempDirectory, DEFAULT_SQL_FILENAME),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--count") {
      options.count = parsePositiveInteger(argv[index + 1], "count");
      index += 1;
      continue;
    }

    if (arg === "--max-uses") {
      options.maxUses = parsePositiveInteger(argv[index + 1], "max-uses");
      index += 1;
      continue;
    }

    if (arg === "--prefix") {
      options.prefix = sanitizePrefix(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--json-output") {
      options.jsonOutput = path.resolve(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg === "--sql-output") {
      options.sqlOutput = path.resolve(argv[index + 1] ?? "");
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function randomCharacter() {
  return CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
}

function buildCodeBody() {
  return CODE_SEGMENTS.map((segmentLength) => {
    let segment = "";

    for (let index = 0; index < segmentLength; index += 1) {
      segment += randomCharacter();
    }

    return segment;
  }).join("-");
}

function hashInviteCode(code) {
  return createHash("sha256").update(code).digest("hex");
}

function generateUniqueCodes(count, prefix) {
  const codes = new Set();

  while (codes.size < count) {
    codes.add(`${prefix}-${buildCodeBody()}`);
  }

  return [...codes];
}

function buildBatchName(timestamp) {
  return `invite-batch-${timestamp
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")}`;
}

function buildInviteCodeRecords({ count, maxUses, prefix }) {
  const generatedAt = new Date().toISOString();
  const batchName = buildBatchName(generatedAt);
  const codes = generateUniqueCodes(count, prefix);

  const records = codes.map((code) => ({
    code,
    code_hash: hashInviteCode(code),
    batch_name: batchName,
    max_uses: maxUses,
    uses_count: 0,
    is_active: true,
  }));

  return {
    generatedAt,
    batchName,
    count,
    maxUses,
    prefix,
    records,
  };
}

function escapeSqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildSqlDocument(batch) {
  const values = batch.records
    .map(
      (record) =>
        `  (${escapeSqlString(record.code_hash)}, ${escapeSqlString(
          record.batch_name,
        )}, ${record.max_uses}, ${record.uses_count}, ${record.is_active})`,
    )
    .join(",\n");

  return `-- Generated at ${batch.generatedAt}
-- Batch name: ${batch.batchName}
-- Count: ${batch.count}
-- Max uses per code: ${batch.maxUses}

insert into invite_codes (code_hash, batch_name, max_uses, uses_count, is_active)
values
${values}
on conflict (code_hash) do nothing;
`;
}

async function writeOutput(filePath, contents) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, "utf8");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const batch = buildInviteCodeRecords(options);

  await writeOutput(options.jsonOutput, `${JSON.stringify(batch, null, 2)}\n`);
  await writeOutput(options.sqlOutput, buildSqlDocument(batch));

  console.log(`Generated ${batch.count} invite codes.`);
  console.log(`Max uses per code: ${batch.maxUses}`);
  console.log(`Batch name: ${batch.batchName}`);
  console.log(`JSON output: ${options.jsonOutput}`);
  console.log(`SQL output: ${options.sqlOutput}`);
  console.log(
    `Preview: ${batch.records
      .slice(0, 5)
      .map((record) => record.code)
      .join(", ")}`,
  );
}

main().catch((error) => {
  console.error("Failed to generate invite codes.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
