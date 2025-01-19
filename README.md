## Background

I have several google accounts.

Over the years, at least one of my (android) phones had a stupid setting, which backed up all photos to multiple Drives. This was pointless.

So, I end up with two accounts, with largely overlapping media, but some unique media in each account.

I needed a way to consolidate the media into one account, without re-duplicating media.

## Project

This tool:

1. identifies all items within Photos account A (the "cleanup" account) which do not already exist in Photos account B (the "master" account)
2. downloads those items

This leaves you to:

3. Dump those items into the master account (easy via UI)
4. Purge ALL items from the cleanup account (manageable by UI. No API available)

## Usage

1. Save [API credentials](https://console.cloud.google.com/apis/credentials) from Google Cloud Console in this directory, as `credentials.json`

2. The GCP project must have [Photos Library API](https://console.cloud.google.com/apis/api/photoslibrary.googleapis.com) access enabled. Note this is API mostly deprecated in March 2025. The new API won't have any way to help with this use case.

3. In this project root, run:

   `npm install`

   `npm start`

4. You'll need to approve each account access, and copy back the 'token' from the browser callback URLs after each approval.

Think carefully about which account should be the 'master'. For me, it's the one where I'm already paying for more storage (Google One, or whatever it's called.)

## Decisions

- The logic for "does file XYZ exist in account B?" is a bit loose. Between accounts, I found that file names need not match exactly, orientations can switch, and window size can change. Timestamp seems fairly reliable.

- There is no official Google API library for Photos. There is a pure JS one someone made, but writing fresh in TS made troubleshooting much easier for me.
