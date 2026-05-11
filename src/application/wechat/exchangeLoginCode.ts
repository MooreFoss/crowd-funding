import { serverEnv } from "@/src/config/env";

export type MiniProgramLoginSession = {
  openid: string;
  unionid: string | null;
};

export async function exchangeMiniProgramLoginCode(
  input: {
    code: string;
    fetch?: typeof fetch;
  },
): Promise<MiniProgramLoginSession> {
  const code = input.code.trim();

  if (!code) {
    throw new Error("wx.login code is required.");
  }

  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", serverEnv.wechatPayAppId);
  url.searchParams.set("secret", serverEnv.wechatMiniProgramAppSecret);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");

  const response = await (input.fetch ?? fetch)(url, {
    method: "GET",
  });
  const body = (await response.json().catch(() => ({}))) as {
    openid?: string;
    unionid?: string;
    errcode?: number;
    errmsg?: string;
  };

  if (!response.ok || body.errcode || !body.openid) {
    throw new Error(body.errmsg ?? "Failed to exchange wx.login code.");
  }

  return {
    openid: body.openid,
    unionid: body.unionid ?? null,
  };
}
