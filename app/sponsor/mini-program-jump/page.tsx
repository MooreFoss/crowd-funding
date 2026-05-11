import { serverEnv } from "@/src/config/env";

import { MiniProgramJumpClient } from "./MiniProgramJumpClient";

export const dynamic = "force-dynamic";

export default function MiniProgramJumpPage() {
  return (
    <MiniProgramJumpClient
      urlLink={serverEnv.wechatMiniProgramUrlLink}
      urlScheme={serverEnv.wechatMiniProgramUrlScheme}
      miniProgramPath={
        process.env.NEXT_PUBLIC_WECHAT_MINI_PROGRAM_PATH ??
        "pages/crowdfunding/sponsor"
      }
    />
  );
}
