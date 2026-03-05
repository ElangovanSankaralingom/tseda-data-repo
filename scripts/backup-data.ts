import { createBackupZip } from "../lib/backup/backupService.ts";

async function run() {
  const result = await createBackupZip();
  if (!result.ok) {
    const message = result.error.message || "Backup failed.";
    console.error(`backup:data failed: ${message}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `backup:data created ${result.data.filename} (${result.data.sizeBytes} bytes)`
  );
}

void run();
