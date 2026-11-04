import { randomBytes, scryptSync } from "node:crypto";
import { writeFile, access } from "node:fs/promises";
try {
  await access(".env.local");
  console.log(".env.local already exists; left unchanged.");
} catch {
  const password = randomBytes(12).toString("base64url");
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  await writeFile(
    ".env.local",
    `# Local demo only. Change settings before deployment.\nADMIN_USERNAME=admin\n# Initial login password; remove this comment after storing it securely: ${password}\nADMIN_PASSWORD_HASH=${salt}:${hash}\nSESSION_SECRET=${randomBytes(48).toString("hex")}\nCOOKIE_SECURE=false\nCMS_STORAGE=file\nDATA_DIR=./data\nMOCK_MODE=true\nMAIN_SYSTEM_URL=http://127.0.0.1:3000\nSIGNAGE_API_KEY=\n`,
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Created .env.local with random local login credentials. See its initial-password comment.",
  );
}
