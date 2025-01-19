import * as fs from "fs";
import * as path from "path";
import { GoogleAuth } from "./services/auth";
import { GooglePhotos, MediaItem } from "./services/photos";

const OUT_DIR = path.join(__dirname, "..", "output");
const MASTER_FILE_LIST_PATH = path.join(OUT_DIR, "data_masterFiles.json");

async function main() {
  let masterItems = readMediaItems(MASTER_FILE_LIST_PATH);
  if (!masterItems) {
    masterItems = await gatherAccountMediaItems("master");
    writeJsonFile(MASTER_FILE_LIST_PATH, masterItems);
  }
  const cleanupPhotos = await authenticatePhotos("cleanup");
  const downloadedFiles: MediaItem[] = [];

  const downloadIfUnique = async (item: MediaItem) => {
    const inMaster = masterHasItem(masterItems!, item);
    if (inMaster) return;
    if (cleanupPhotos.isDownloaded(item)) return;
    await cleanupPhotos.download(item);
    downloadedFiles.push(item);
  };

  await cleanupPhotos.processAllItems(downloadIfUnique);

  console.log(`Downloaded ${downloadedFiles.length} files!`);
}

function masterHasItem(masterItems: MediaItem[], item: MediaItem) {
  return masterItems.some((masterItem) => {
    const nameMatch = masterItem.filename.includes(item.filename);

    const windowMatch =
      masterItem.mediaMetadata?.height === item.mediaMetadata?.height &&
      masterItem.mediaMetadata?.width === item.mediaMetadata?.width;
    const invertedWindowMatch =
      masterItem.mediaMetadata?.height === item.mediaMetadata?.width &&
      masterItem.mediaMetadata?.width === item.mediaMetadata?.height;

    const createdMatch =
      masterItem.mediaMetadata?.creationTime ===
      item.mediaMetadata?.creationTime;

    return nameMatch && (windowMatch || invertedWindowMatch || createdMatch);
  });
}

function safelyReadFile(filePath: string) {
  try {
    const data = fs.readFileSync(filePath, "utf8");
    return data;
  } catch (err) {
    if (
      err instanceof Error &&
      (err as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return null;
    } else {
      throw err;
    }
  }
}

function readMediaItems(filePath: string) {
  const data = safelyReadFile(filePath);
  if (!data) {
    return null;
  }
  try {
    return JSON.parse(data) as MediaItem[];
  } catch (err) {
    console.error(`Error parsing JSON from ${filePath}`);
    throw err;
  }
}

function writeJsonFile(filePath: string, data: any) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

async function authenticatePhotos(nickname: string) {
  console.log(`Authenticating ${nickname} account...`);
  const auth = await GoogleAuth.create(nickname);
  const token = await auth.getAccessToken();
  return new GooglePhotos(token);
}

async function gatherAccountMediaItems(
  nickname: string,
  photos?: GooglePhotos
) {
  if (!photos) {
    photos = await authenticatePhotos(nickname);
  }
  console.log(`Fetching ${nickname} account media...`);
  return await photos.listAll();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
