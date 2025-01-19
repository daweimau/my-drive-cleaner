import * as fs from "fs";
import * as path from "path";
import readline from "readline";
import { OAuth2Client } from "google-auth-library";

const CREDENTIALS_PATH = path.join(__dirname, "..", "..", "credentials.json");

function createTokenPath(accountNickname: string) {
  return path.join(__dirname, "..", "..", `token${accountNickname}.json`);
}

/**
 * Simple helper to read from stdin
 */
function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    })
  );
}

export class GoogleAuth {
  private constructor(private client: OAuth2Client) {}

  public static async create(
    /** Used to label and recognise saved tokens */
    accountNickname: string
  ) {
    console.log(`Authenticating ${accountNickname} account...`);

    const tokenPath = createTokenPath(accountNickname);
    const client = await GoogleAuth.authorize(tokenPath);

    return new GoogleAuth(client);
  }

  /** Get short-lived access token */
  public async getAccessToken() {
    const tokenRes = await this.client.getAccessToken();
    const token = tokenRes?.token;
    if (!token) {
      throw new Error("Could not obtain master access token");
    }
    return token;
  }

  /**
   * OAuth Flow: If we have a token on disk, use it.
   * Otherwise, open a browser URL for user consent, store the refresh token, etc.
   */
  private static async authorize(tokenPath: string) {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8"));
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new OAuth2Client(
      client_id,
      client_secret,
      redirect_uris[0]
    );

    if (fs.existsSync(tokenPath)) {
      console.log("Existing token found. Reusing...");
      // Reuse existing tokens
      const token = JSON.parse(fs.readFileSync(tokenPath, "utf-8"));
      oAuth2Client.setCredentials(token);
      return oAuth2Client;
    }

    // Otherwise, we need to prompt for new tokens
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/photoslibrary.readonly"],
    });
    console.log(`\nAuthorize this app by visiting:\n  ${authUrl}\n`);

    const code = await askQuestion("Enter the code from that page: ");
    const tokenResponse = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokenResponse.tokens);

    // Save for future use
    fs.writeFileSync(tokenPath, JSON.stringify(tokenResponse.tokens), "utf-8");
    console.log(`Token stored at ${tokenPath}`);
    return oAuth2Client;
  }
}
