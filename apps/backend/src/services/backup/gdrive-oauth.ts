/** Google OAuth 2.0 device flow + token endpoints, via plain fetch (no googleapis SDK). */

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DEVICE_URL = 'https://oauth2.googleapis.com/device/code';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

export class DriveAuthError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'DriveAuthError';
  }
}

export interface DeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresIn: number;
  interval: number;
}

async function postForm(url: string, params: Record<string, string>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString()
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    // non-JSON error body
  }
  return { res, json, text };
}

export async function requestDeviceCode(clientId: string): Promise<DeviceCode> {
  const { res, json } = await postForm(DEVICE_URL, { client_id: clientId, scope: DRIVE_SCOPE });
  if (!res.ok || !json.device_code) {
    throw new DriveAuthError(
      `Google từ chối yêu cầu kết nối: ${String(json.error_description ?? json.error ?? res.status)}. ` +
        'Kiểm tra Client ID và loại OAuth client (TVs and Limited Input devices).',
      String(json.error ?? 'device_code_failed')
    );
  }
  return {
    deviceCode: String(json.device_code),
    userCode: String(json.user_code),
    verificationUrl: String(json.verification_url ?? json.verification_uri),
    expiresIn: Number(json.expires_in ?? 1800),
    interval: Number(json.interval ?? 5)
  };
}

export type PollResult =
  | { status: 'pending'; slowDown?: boolean }
  | { status: 'ok'; refreshToken: string; accessToken: string; expiresIn: number }
  | { status: 'denied' }
  | { status: 'expired' };

export async function pollDeviceToken(
  clientId: string,
  clientSecret: string,
  deviceCode: string
): Promise<PollResult> {
  const { res, json } = await postForm(TOKEN_URL, {
    client_id: clientId,
    client_secret: clientSecret,
    device_code: deviceCode,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
  });
  if (res.ok && json.refresh_token) {
    return {
      status: 'ok',
      refreshToken: String(json.refresh_token),
      accessToken: String(json.access_token),
      expiresIn: Number(json.expires_in ?? 3600)
    };
  }
  switch (json.error) {
    case 'authorization_pending':
      return { status: 'pending' };
    case 'slow_down':
      return { status: 'pending', slowDown: true };
    case 'access_denied':
      return { status: 'denied' };
    case 'expired_token':
      return { status: 'expired' };
    default:
      throw new DriveAuthError(
        `Google trả lỗi khi lấy token: ${String(json.error_description ?? json.error ?? res.status)}`,
        String(json.error ?? 'token_failed')
      );
  }
}

export async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const { res, json } = await postForm(TOKEN_URL, {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });
  if (!res.ok || !json.access_token) {
    throw new DriveAuthError(
      json.error === 'invalid_grant'
        ? 'Kết nối Google Drive đã hết hạn hoặc bị thu hồi. Vui lòng kết nối lại.'
        : `Không làm mới được token Google: ${String(json.error_description ?? json.error ?? res.status)}`,
      String(json.error ?? 'refresh_failed')
    );
  }
  return { accessToken: String(json.access_token), expiresIn: Number(json.expires_in ?? 3600) };
}

export async function revokeToken(token: string): Promise<void> {
  try {
    await postForm(REVOKE_URL, { token });
  } catch {
    // revocation is best effort; local secrets are removed regardless
  }
}

