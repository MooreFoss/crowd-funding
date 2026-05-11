import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PublicListPagination } from "@/src/ui/components/PublicListPagination";

describe("PublicListPagination", () => {
  it("renders refresh and next-page links from the current page state", () => {
    const html = renderToStaticMarkup(
      createElement(PublicListPagination, {
        basePath: "/pledges",
        page: {
          limit: 10,
          offset: 10,
          hasMore: true,
          nextOffset: 20,
        },
        totalLoaded: 10,
      }),
    );

    expect(html).toContain('href="/pledges"');
    expect(html).toContain('href="/pledges?page=1"');
    expect(html).toContain('href="/pledges?page=3"');
    expect(html).toContain("刷新列表");
    expect(html).toContain("上一页");
    expect(html).toContain("下一页");
  });

  it("does not render disabled pagination as fake links", () => {
    const html = renderToStaticMarkup(
      createElement(PublicListPagination, {
        basePath: "/expenses",
        page: {
          limit: 10,
          offset: 0,
          hasMore: false,
          nextOffset: null,
        },
        totalLoaded: 3,
      }),
    );

    expect(html).toContain('href="/expenses"');
    expect(html).not.toContain('href="/expenses?page=0"');
    expect(html).not.toContain('href="/expenses?page=2"');
    expect(html).toContain("已显示当前页全部记录");
  });
});
