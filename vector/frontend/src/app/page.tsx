"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload, Link, Search, FileText, Trash2, Loader2,
  CheckCircle2, XCircle, ChevronDown, ChevronUp, RefreshCw
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// 上传状态
type UploadStatus = "idle" | "uploading" | "success" | "error";

// 单条检索结果
interface SearchResult {
  content: string;
  metadata: Record<string, unknown>;
  score?: number;
}

export default function HomePage() {
  // --- Tab 切换 ---
  const [activeTab, setActiveTab] = useState<"upload" | "search">("upload");

  // --- 上传状态 ---
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadDocId, setUploadDocId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- URL 抓取状态 ---
  const [urlInput, setUrlInput] = useState("");
  const [crawlStatus, setCrawlStatus] = useState<UploadStatus>("idle");
  const [crawlMessage, setCrawlMessage] = useState("");
  const [crawlDocId, setCrawlDocId] = useState("");

  // --- 检索状态 ---
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set());

  // --- 文档列表状态 ---
  const [docs, setDocs] = useState<{ doc_id: string; filename: string; source_type: string; chunk_count: number }[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // ===== 文件上传 =====
  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const formData = new FormData();
    formData.append("file", file);
    setUploadStatus("uploading");
    setUploadMessage("");

    try {
      const res = await fetch(`${API_BASE}/upload/file`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "上传失败");
      setUploadStatus("success");
      setUploadMessage(data.message);
      setUploadDocId(data.doc_id);
    } catch (err: unknown) {
      setUploadStatus("error");
      setUploadMessage(err instanceof Error ? err.message : "未知错误");
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    handleFileUpload(e.dataTransfer.files);
  }, [handleFileUpload]);

  // ===== URL 抓取 =====
  const handleCrawl = useCallback(async () => {
    if (!urlInput.trim()) return;
    setCrawlStatus("uploading");
    setCrawlMessage("");
    try {
      const res = await fetch(`${API_BASE}/crawl/url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "抓取失败");
      setCrawlStatus("success");
      setCrawlMessage(data.message);
      setCrawlDocId(data.doc_id);
    } catch (err: unknown) {
      setCrawlStatus("error");
      setCrawlMessage(err instanceof Error ? err.message : "未知错误");
    }
  }, [urlInput]);

  // ===== 语义检索 =====
  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearched(false);
    setResults([]);
    setExpandedChunks(new Set());
    try {
      const res = await fetch(`${API_BASE}/query/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), top_k: 5 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "检索失败");
      setResults(data.results);
      setSearched(true);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  }, [query]);

  // ===== 加载文档列表 =====
  const loadDocs = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const res = await fetch(`${API_BASE}/query/documents`);
      const data = await res.json();
      setDocs(data.documents || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  // 切换 Tab 时自动加载文档列表
  const toggleTab = (tab: "upload" | "search") => {
    setActiveTab(tab);
    if (tab === "upload") loadDocs();
  };

  const toggleChunk = (i: number) => {
    setExpandedChunks(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      {/* 标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">📄 文档向量化检索</h1>
        <p className="text-slate-400 text-sm">PDF / Markdown / 网页 URL → 语义向量存储 → 精准检索</p>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2 mb-6">
        {[
          { key: "upload", label: "上传文档", icon: Upload },
          { key: "search", label: "语义检索", icon: Search },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => toggleTab(key as "upload" | "search")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === key
                ? "bg-blue-600 text-white"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* ===== 上传面板 ===== */}
      {activeTab === "upload" && (
        <div className="space-y-6">
          {/* 文件上传区 */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <Upload size={18} className="text-blue-400" />
              上传文件（PDF / Markdown）
            </h2>

            {/* 拖拽区域 */}
            <div
              className={`border-2 border-dashed rounded-lg p-10 text-center transition-all cursor-pointer ${
                dragActive
                  ? "border-blue-400 bg-blue-400/5"
                  : "border-slate-600 hover:border-slate-500"
              }`}
              onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mx-auto mb-3 text-slate-400" size={32} />
              <p className="text-slate-300 text-sm mb-1">拖拽文件到此处，或点击选择文件</p>
              <p className="text-slate-500 text-xs">支持 .pdf .md .txt，单文件最大 50MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.md,.markdown,.txt"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
            </div>

            {/* 上传状态反馈 */}
            {uploadStatus !== "idle" && (
              <div className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
                uploadStatus === "success" ? "bg-green-900/20 border border-green-800" :
                uploadStatus === "error" ? "bg-red-900/20 border border-red-800" :
                "bg-slate-700/50 border border-slate-600"
              }`}>
                {uploadStatus === "uploading" && <Loader2 size={18} className="text-blue-400 animate-spin mt-0.5" />}
                {uploadStatus === "success" && <CheckCircle2 size={18} className="text-green-400 mt-0.5" />}
                {uploadStatus === "error" && <XCircle size={18} className="text-red-400 mt-0.5" />}
                <div>
                  <p className="text-sm font-medium text-white">{uploadMessage}</p>
                  {uploadDocId && (
                    <p className="text-xs text-slate-400 mt-1">文档ID: {uploadDocId}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* URL 抓取区 */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <Link size={18} className="text-blue-400" />
              抓取网页（输入 URL）
            </h2>
            <div className="flex gap-3">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCrawl()}
                placeholder="https://example.com/article"
                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button
                onClick={handleCrawl}
                disabled={crawlStatus === "uploading"}
                className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
              >
                {crawlStatus === "uploading" ? <Loader2 size={16} className="animate-spin" /> : <Link size={16} />}
                抓取
              </button>
            </div>
            {crawlMessage && (
              <div className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
                crawlStatus === "success" ? "bg-green-900/20 border border-green-800" :
                "bg-red-900/20 border border-red-800"
              }`}>
                {crawlStatus === "success" ? <CheckCircle2 size={18} className="text-green-400 mt-0.5" /> : <XCircle size={18} className="text-red-400 mt-0.5" />}
                <p className="text-sm text-white">{crawlMessage}</p>
              </div>
            )}
          </div>

          {/* 已入库文档列表 */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <FileText size={18} className="text-blue-400" />
                已入库文档
              </h2>
              <button onClick={loadDocs} className="text-slate-400 hover:text-white transition-colors">
                <RefreshCw size={16} />
              </button>
            </div>

            {loadingDocs ? (
              <div className="text-center py-8 text-slate-500 text-sm">加载中...</div>
            ) : docs.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">
                暂无已入库文档，请先上传文件或抓取 URL
              </div>
            ) : (
              <div className="space-y-2">
                {docs.map((doc) => (
                  <div key={doc.doc_id} className="flex items-center justify-between p-3 bg-slate-900 rounded-lg border border-slate-700">
                    <div className="flex items-center gap-3">
                      <FileText size={16} className="text-slate-400" />
                      <div>
                        <p className="text-sm text-white font-medium truncate max-w-md">{doc.filename || doc.doc_id}</p>
                        <p className="text-xs text-slate-500">
                          ID: {doc.doc_id} · {doc.source_type} · {doc.chunk_count} 块
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        await fetch(`${API_BASE}/query/documents/${doc.doc_id}`, { method: "DELETE" });
                        loadDocs();
                      }}
                      className="text-slate-500 hover:text-red-400 transition-colors p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== 检索面板 ===== */}
      {activeTab === "search" && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Search size={18} className="text-blue-400" />
            语义检索
          </h2>
          <div className="flex gap-3 mb-6">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="输入你想查询的内容，比如：光伏银浆需求2025预测"
              className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
            >
              {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              检索
            </button>
          </div>

          {/* 检索结果 */}
          {searched && results.length === 0 && (
            <div className="text-center py-10 text-slate-500 text-sm">
              未找到相关结果，请尝试其他关键词
            </div>
          )}
          {results.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">{results.length} 个相关文本块</p>
              {results.map((result, i) => {
                const isExpanded = expandedChunks.has(i);
                const preview = result.content.slice(0, 200);
                return (
                  <div key={i} className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                    <button
                      className="w-full text-left p-4 hover:bg-slate-800 transition-colors"
                      onClick={() => toggleChunk(i)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm leading-relaxed">
                            {isExpanded ? result.content : preview + (result.content.length > 200 ? "..." : "")}
                          </p>
                          {result.metadata && Object.keys(result.metadata).length > 0 && (
                            <p className="text-xs text-slate-500 mt-2">
                              来源: {result.metadata.doc_id || "未知"}
                              {result.metadata.title ? ` · ${result.metadata.title}` : ""}
                            </p>
                          )}
                        </div>
                        <div className="text-slate-400 mt-1 flex-shrink-0">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}