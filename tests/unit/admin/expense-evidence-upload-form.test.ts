import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ExpenseEvidenceUploadForm } from "@/app/admin/expenses/ExpenseEvidenceUploadForm";

describe("ExpenseEvidenceUploadForm", () => {
  it("explains evidence label and sort order fields", () => {
    const html = renderToStaticMarkup(
      createElement(ExpenseEvidenceUploadForm, {
        action: "/api/admin/expenses",
        defaultSortOrder: 3,
        expenseId: "expense-1",
        intent: "add-evidence",
        submitLabel: "添加凭证",
        submitClassName: "button",
      }),
    );

    expect(html).toContain("用于给这份凭证起一个展示名");
    expect(html).toContain("右侧数字是展示顺序");
    expect(html).toContain("数字越小越靠前");
  });
});
