// src/services/crawler.ts
import axios from "axios";
import * as cheerio from "cheerio";
import TurndownService from "turndown";
import { load } from "cheerio";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

// ============ 主入口 ============

/**
 * URL → HTML → Markdown
 *
 * 策略：
 * 1. axios GET（带 User-Agent 伪装）
 * 2. cheerio 清洗噪音（导航/页脚/广告）
 * 3. turndown HTML → Markdown
 */
export async function fetchUrl(url: string): Promise<{ title: string; markdown: string }> {
  // 1. 抓取 HTML
  const html = await fetchHtml(url);

  // 2. 清洗 HTML
  const cleaned = cleanHtml(html);

  // 3. HTML → Markdown
  const markdown = turndown.turndown(cleaned);

  // 4. 清理 Markdown 噪音
  const cleanMd = cleanMarkdown(markdown);

  // 5. 提取标题
  const $ = load(html);
  const title = $("title").text().trim() || $("h1").first().text().trim() || url;

  return { title, markdown: cleanMd };
}

// ============ 内部函数 ============

async function fetchHtml(url: string): Promise<string> {
  try {
    const res = await axios.get(url, {
      timeout: 15000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
      maxRedirects: 5,
    });
    return res.data;
  } catch (err: any) {
    throw new Error(`网页抓取失败: ${err.message}`);
  }
}

function cleanHtml(html: string): string {
  const $ = load(html);

  // 移除噪音标签
  const noiseSelectors = [
    "script", "style", "noscript", "iframe", "embed", "object",
    "nav", "footer", "header", "aside",
    "[class*='nav']", "[class*='menu']", "[class*='sidebar']",
    "[class*='footer']", "[class*='header']",
    "[class*='ad']", "[class*='advertisement']",
    "[id*='nav']", "[id*='menu']", "[id*='sidebar']",
    "[id*='footer']", "[id*='header']",
  ];

  for (const sel of noiseSelectors) {
    try { $(sel).remove(); } catch { /* skip invalid selector */ }
  }

  // 提取主体内容
  const mainSelectors = ["main", "article", "[role='main']", ".content", "#content", ".post", ".article-body"];
  for (const sel of mainSelectors) {
    const el = $(sel);
    if (el.length > 0) {
      return el.html() || $.html();
    }
  }

  return $.html();
}

function cleanMarkdown(md: string): string {
  const lines = md.split("\n");
  const noisePatterns = [
    /^(登录|注册|版权|copyright|©|©\s*20)/i,
    /^\s*[\[【(]?(广告|推广|赞助|advertisement)/i,
    /^#+\s*$/,                          // 空标题
    /^\s*\|[\s\-:|]+\|\s*$/,            // 空表格行
  ];

  return lines
    .filter((line) => {
      if (!line.trim()) return false;
      return !noisePatterns.some((p) => p.test(line.trim()));
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")         // 去除多余空行
    .trim();
}
