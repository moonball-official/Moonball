import * as fs from "fs";
import * as path from "path";

export interface DeploymentWriteResult {
  file: string;
  archivedFile?: string;
}

function safeRecordName(recordName: string): void {
  if (
    !recordName ||
    recordName.includes("..") ||
    !/^[A-Za-z0-9_.-]+$/.test(recordName)
  ) {
    throw new Error("Deployment record name contains unsafe path characters.");
  }
}

/** Preserve an existing record before replacing it with a newly verified run. */
export function writeDeploymentRecord(
  directory: string,
  recordName: string,
  record: Record<string, unknown>
): DeploymentWriteResult {
  safeRecordName(recordName);
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `${recordName}.json`);
  let archivedFile: string | undefined;

  if (fs.existsSync(file)) {
    const historyDirectory = path.join(directory, "history");
    fs.mkdirSync(historyDirectory, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    let suffix = 0;
    do {
      const discriminator = suffix === 0 ? "" : `-${suffix}`;
      archivedFile = path.join(
        historyDirectory,
        `${recordName}-${timestamp}${discriminator}.json`
      );
      suffix++;
    } while (fs.existsSync(archivedFile));
    fs.copyFileSync(file, archivedFile, fs.constants.COPYFILE_EXCL);
  }

  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return { file, archivedFile };
}
