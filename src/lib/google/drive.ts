import { google } from "googleapis";
import { Readable } from "stream";
import { DRIVE_FOLDER_NAME } from "@/lib/constants";

/**
 * Get an authenticated Google Drive client using a Service Account.
 * Credentials are stored in a single JSON environment variable (base64 or raw JSON).
 */
function getDriveClient() {
  const credentialsRaw = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT;
  if (!credentialsRaw) throw new Error("GOOGLE_DRIVE_SERVICE_ACCOUNT not configured");

  let credentials: object;
  try {
    // Support both raw JSON and base64-encoded JSON
    const decoded = Buffer.from(credentialsRaw, "base64").toString("utf8");
    credentials = JSON.parse(decoded);
  } catch {
    credentials = JSON.parse(credentialsRaw);
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return google.drive({ version: "v3", auth });
}

/**
 * Find or create the "Admissions Documents" folder in Google Drive.
 * Returns the folder ID.
 */
async function getOrCreateFolder(drive: ReturnType<typeof google.drive>, folderName: string): Promise<string> {
  const res = await drive.files.list({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id)",
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  }

  // Create folder
  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id",
  });

  return folder.data.id!;
}

/**
 * Upload a PDF Buffer to Google Drive (private by default — no public sharing).
 * Returns the Drive file ID.
 */
export async function uploadToDrive({
  buffer,
  filename,
  mimeType = "application/pdf",
  folderName = DRIVE_FOLDER_NAME,
}: {
  buffer: Buffer;
  filename: string;
  mimeType?: string;
  folderName?: string;
}): Promise<string> {
  const drive = getDriveClient();
  const folderId = await getOrCreateFolder(drive, folderName);

  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: "id",
  });

  return res.data.id!;
}

