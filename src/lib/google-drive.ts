import { prisma } from "@/src/lib/prisma";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Adds the service account email as an editor on a Google Sheet.
 *
 * @param sheetId - The Google Sheet ID
 * @param accessToken - A valid Google OAuth access token with drive scope
 */
export async function shareSheetWithServiceAccount(
  sheetId: string,
  accessToken: string
): Promise<void> {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (!serviceAccountEmail) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL is not configured in .env"
    );
  }

  const res = await fetch(
    `${DRIVE_API}/files/${sheetId}/permissions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: "writer",
        type: "user",
        emailAddress: serviceAccountEmail,
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 404) {
      throw new Error(
        `Sheet not found (404). Make sure the Sheet ID is correct and the sheet exists.`
      );
    }
    if (res.status === 403) {
      throw new Error(
        `Access denied (403). You don't have permission to share this sheet. Make sure you own it.`
      );
    }
    throw new Error(
      `Failed to share sheet with service account (${res.status}): ${body}`
    );
  }
}

/**
 * Fetches the admin's Google OAuth access token from the Account table,
 * refreshing it if necessary.
 *
 * @param adminId - The admin's user ID
 * @returns A valid access token
 */
export async function getAdminAccessToken(
  adminId: string
): Promise<string> {
  const account = await prisma.account.findFirst({
    where: { userId: adminId, provider: "google" },
    select: {
      access_token: true,
      refresh_token: true,
      expires_at: true,
    },
  });

  if (!account || !account.access_token) {
    throw new Error(
      "No Google OAuth token found. Please sign out and sign in again to grant Drive access."
    );
  }

  // Token is still valid
  if (account.expires_at && account.expires_at * 1000 > Date.now()) {
    return account.access_token;
  }

  // Token expired — try to refresh
  if (!account.refresh_token) {
    throw new Error(
      "No refresh token available. Please sign out and sign in again to grant offline Drive access."
    );
  }

  const params = new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID || "",
    client_secret: process.env.AUTH_GOOGLE_SECRET || "",
    refresh_token: account.refresh_token,
    grant_type: "refresh_token",
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(
      `Failed to refresh Google token: ${err}. Please sign out and sign in again.`
    );
  }

  const data = await res.json();
  const newToken = data.access_token as string;
  const newExpiry = data.expires_in
    ? Math.floor(Date.now() / 1000) + data.expires_in
    : undefined;

  // Update the stored token
  await prisma.account.updateMany({
    where: { userId: adminId, provider: "google" },
    data: {
      access_token: newToken,
      expires_at: newExpiry,
    },
  });

  return newToken;
}
