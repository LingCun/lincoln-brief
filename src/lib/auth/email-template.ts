export interface LoginEmailParams {
  loginUrl: string;
  expiresInMinutes: number;
}

export function loginEmailText(params: LoginEmailParams): string {
  return [
    `Lincoln Brief 로그인 링크입니다.`,
    ``,
    `아래 링크를 클릭하시면 로그인되고 잠긴 글을 보실 수 있습니다.`,
    ``,
    params.loginUrl,
    ``,
    `이 링크는 ${params.expiresInMinutes}분 동안만 유효하며 한 번만 사용할 수 있습니다.`,
    ``,
    `링크를 요청하지 않으셨다면 이 메일을 무시해주세요.`,
    ``,
    `— Lincoln`,
  ].join('\n');
}

export function loginEmailHtml(params: LoginEmailParams): string {
  return `<!doctype html>
<html lang="ko">
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Noto Sans KR', sans-serif; max-width: 480px; margin: 40px auto; padding: 24px; line-height: 1.6; color: #0f0c08;">
    <h1 style="font-size: 18px; margin: 0 0 16px;">Lincoln Brief 로그인 링크</h1>
    <p style="margin: 0 0 24px; color: #444;">아래 버튼을 클릭하시면 로그인되고 잠긴 글을 보실 수 있습니다.</p>
    <p style="margin: 0 0 32px;">
      <a href="${escapeHtml(params.loginUrl)}"
         style="display:inline-block; background:#d8b878; color:#0f0c08; text-decoration:none; padding:14px 28px; font-weight:600; border-radius:4px;">
        로그인하기
      </a>
    </p>
    <p style="font-size: 12px; color: #888; margin: 0 0 8px;">
      또는 다음 링크를 브라우저에 직접 붙여넣어주세요:
    </p>
    <p style="font-size: 11px; color: #555; word-break: break-all; margin: 0 0 24px;">
      ${escapeHtml(params.loginUrl)}
    </p>
    <p style="font-size: 12px; color: #888; margin: 0 0 4px;">
      이 링크는 ${params.expiresInMinutes}분 동안만 유효하며 한 번만 사용할 수 있습니다.
    </p>
    <p style="font-size: 12px; color: #888; margin: 0 0 32px;">
      링크를 요청하지 않으셨다면 이 메일을 무시해주세요.
    </p>
    <p style="font-size: 12px; color: #aaa; margin: 0;">— Lincoln Brief</p>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
