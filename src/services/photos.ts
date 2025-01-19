import { createWriteStream, existsSync } from "fs";
import { pipeline } from "stream";
import { promisify } from "util";
import path from "path";

const BASE_PATH = "https://photoslibrary.googleapis.com/v1/mediaItems";
const IMAGES_LOCAL_PATH = path.join(__dirname, "..", "..", "downloads");

const streamPipeline = promisify(pipeline);

type GetBaseParams = {
  urlOverride?: string;
  endPoint?: string;
  queryParams?: URLSearchParams;
};

interface ErrorResponse extends Response {
  error: {
    code: number;
    message: string;
    status: string;
  };
}

function isErrorResponse(res: Response): res is ErrorResponse {
  return !res.ok;
}

export type MediaItem = {
  id: string;
  filename: string;
  mimeType: string;
  productUrl: string;
  baseUrl: string;
  mediaMetadata?: {
    /** e.g. "2014-10-02T15:01:23Z" */
    creationTime?: string;
    width?: string;
    height?: string;
  };
};

type MediaItemsListResponse = {
  mediaItems: MediaItem[];
  nextPageToken?: string;
};

export class GooglePhotos {
  constructor(private authToken: string) {}

  private async get(p: GetBaseParams) {
    let url = p.urlOverride || BASE_PATH;
    if (p.endPoint) {
      url += `/${p.endPoint}`;
    }
    if (p.queryParams) {
      url += `?${p.queryParams.toString()}`;
    }
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.authToken}`,
      },
    });
    if (isErrorResponse(res))
      throw new Error(`\n${res.error.code} - ${res.error.message}\n`);

    return res;
  }

  public async listOnePage(pageSize = 100, pageToken?: string) {
    const params = new URLSearchParams({
      pageSize: pageSize.toString(),
      ...(pageToken && { pageToken }),
    });
    const res = await this.get({ queryParams: params });
    const data = await res.json();
    return data as MediaItemsListResponse;
  }

  public async listAll() {
    const allItems: MediaItem[] = [];
    const pageSize = 100;
    let pageToken: string | undefined = undefined;
    let pageNum = 1;
    do {
      console.log(`Fetching page ${pageNum++}...`);
      const res: MediaItemsListResponse = await this.listOnePage(
        pageSize,
        pageToken
      );
      const { mediaItems, nextPageToken } = res;
      allItems.push(...mediaItems);
      pageToken = nextPageToken;
    } while (pageToken);
    console.log(`\nFetched ${allItems.length} items!\n`);
    return allItems;
  }

  public async processAllItems(
    processFn: (item: MediaItem) => Promise<void> | void
  ) {
    const processedItems: MediaItem[] = [];
    const pageSize = 100;
    let pageToken: string | undefined = undefined;
    let pageNum = 1;

    do {
      console.log(`Fetching page ${pageNum++}...`);
      const res: MediaItemsListResponse = await this.listOnePage(
        pageSize,
        pageToken
      );
      const { mediaItems, nextPageToken } = res;

      for (const item of mediaItems) {
        await processFn(item);
        processedItems.push(item);
      }

      pageToken = nextPageToken;
    } while (pageToken);

    return processedItems;
  }

  public async getOne(mediaItemId: string) {
    const res = await this.get({ endPoint: mediaItemId });
    return res.json() as Promise<MediaItem>;
  }

  public isDownloaded(item: MediaItem) {
    const savePath = path.join(IMAGES_LOCAL_PATH, item.filename);
    return existsSync(savePath);
  }

  public async download(item: MediaItem) {
    const isVideo = item.mimeType?.startsWith("video/");
    const downloadParam = isVideo ? "dv" : "d";
    const urlOverride = `${item.baseUrl}=${downloadParam}`;
    const res = await this.get({ urlOverride });

    const savePath = path.join(IMAGES_LOCAL_PATH, item.filename);
    const stream = createWriteStream(savePath);
    await streamPipeline(res.body as any, stream);
    console.log(`Downloaded ${item.filename} to ${savePath}`);
    return;
  }
}
