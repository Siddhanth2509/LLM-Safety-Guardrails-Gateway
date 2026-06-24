"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Upload,
  FileText,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Brain,
  Eye,
  Shield,
  ArrowRight,
  Zap,
  Database,
  Clock,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Loader2,
  FileUp,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────

interface Document {
  id: string;
  title: string;
  chunkCount: number;
  createdAt: string;
}

interface RetrievedChunk {
  id: string;
  text: string;
  documentId: string;
  score: number;
  chunkIndex: number;
}

interface PipelineEvent {
  step: string;
  iteration: number;
  timestamp: number;
  detail?: string;
  chunks?: { id: string; text: string; score: number }[];
  critique?: { grounded: boolean; reason: string; confidence: number };
}

interface PipelineResult {
  answer: string;
  status: string;
  iterations: number;
  events: PipelineEvent[];
  retrievedChunks: RetrievedChunk[];
  latencyMs: number;
}

interface QueryLog {
  id: string;
  query: string;
  answer: string;
  status: string;
  iterations: number;
  latencyMs: number;
  createdAt: string;
  pipelineLog: string;
}

// ─── Step Config ────────────────────────────────────────────────────

const STEP_CONFIG: Record<
  string,
  { icon: React.ReactNode; color: string; label: string }
> = {
  retrieving: {
    icon: <Database className="w-4 h-4" />,
    color: "text-sky-400",
    label: "Retrieve",
  },
  generating: {
    icon: <Sparkles className="w-4 h-4" />,
    color: "text-violet-400",
    label: "Generate",
  },
  critiquing: {
    icon: <Shield className="w-4 h-4" />,
    color: "text-amber-400",
    label: "Critique",
  },
  reformulating: {
    icon: <RefreshCw className="w-4 h-4" />,
    color: "text-orange-400",
    label: "Reformulate",
  },
  accepted: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: "text-emerald-400",
    label: "Accepted",
  },
  fallback: {
    icon: <AlertTriangle className="w-4 h-4" />,
    color: "text-red-400",
    label: "Fallback",
  },
};

// ─── Main Component ─────────────────────────────────────────────────

export default function HomePage() {
  // Knowledge base state
  const [documents, setDocuments] = useState<Document[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);

  // Query state
  const [query, setQuery] = useState("");
  const [isQuerying, setIsQuerying] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [queryHistory, setQueryHistory] = useState<QueryLog[]>([]);

  // UI state
  const [showChunks, setShowChunks] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const queryInputRef = useRef<HTMLTextAreaElement>(null);

  // ── Fetch documents on mount ──
  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      setDocuments(data.documents || []);
      setTotalChunks(data.totalChunks || 0);
    } catch {
      toast.error("Failed to load documents");
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/query");
      const data = await res.json();
      setQueryHistory(data.logs || []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
    fetchHistory();
  }, [fetchDocuments, fetchHistory]);

  // ── Read file as text ──
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  };

  // ── Process a single uploaded file ──
  const processFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["txt", "md", "csv", "json", "html", "xml"].includes(ext)) {
      toast.error(`Unsupported format: .${ext || "?"} — use .txt, .md, .csv, .json`);
      return;
    }
    setUploadingFileName(file.name);
    try {
      const content = await readFileAsText(file);
      if (!content || content.trim().length === 0) {
        toast.error(`"${file.name}" is empty`);
        return;
      }
      const title = newTitle.trim() || file.name.replace(/\.[^.]+$/, "");
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }
      const doc = await res.json();
      toast.success(`Uploaded "${doc.title}" — ${doc.chunkCount} chunks created`);
      setNewTitle("");
      setNewContent("");
      fetchDocuments();
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setUploadingFileName(null);
    }
  };

  // ── Handle file input change ──
  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      processFile(file);
    }
    // Reset input so the same file can be re-uploaded
    e.target.value = "";
  };

  // ── Upload document (text paste) ──
  const handleUpload = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      toast.error("Please provide both title and content");
      return;
    }
    setIsUploading(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), content: newContent }),
      });
      if (!res.ok) throw new Error("Upload failed");
      const doc = await res.json();
      toast.success(`Uploaded "${doc.title}" (${doc.chunkCount} chunks)`);
      setNewTitle("");
      setNewContent("");
      fetchDocuments();
    } catch {
      toast.error("Failed to upload document");
    } finally {
      setIsUploading(false);
    }
  };

  // ── Drag & drop handlers ──
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      processFile(file);
    }
  };

  // ── Delete document ──
  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/documents?id=${id}`, { method: "DELETE" });
      toast.success("Document deleted");
      fetchDocuments();
    } catch {
      toast.error("Failed to delete document");
    }
  };

  // ── Run query ──
  const handleQuery = async () => {
    if (!query.trim()) return;
    setIsQuerying(true);
    setResult(null);
    setActiveStep("retrieving");

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data: PipelineResult = await res.json();

      // Animate through the pipeline steps
      for (const event of data.events) {
        setActiveStep(event.step);
        await new Promise((r) => setTimeout(r, 300));
      }

      setResult(data);
      setActiveStep(null);
      fetchHistory();

      if (data.answer) {
        setTimeout(() => {
          answerRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 200);
      }
    } catch {
      toast.error("Failed to process query");
      setActiveStep(null);
    } finally {
      setIsQuerying(false);
    }
  };

  // ── Load sample documents ──
  const loadSampleData = async () => {
    const sampleDocs = [
      {
        title: "Introduction to RAG Systems",
        content: `Retrieval-Augmented Generation (RAG) is a technique that enhances large language model responses by grounding them in external knowledge sources. Instead of relying solely on the model's parametric memory, RAG systems first retrieve relevant documents from a knowledge base, then use those documents as context for generating an answer.

The core components of a RAG system are: (1) a document store containing the knowledge base, (2) an embedding model that converts text into vector representations, (3) a vector database for efficient similarity search, and (4) a language model that generates responses using the retrieved context.

RAG systems solve several key problems with pure LLMs: they reduce hallucination by grounding responses in real data, they allow the knowledge base to be updated without retraining the model, and they provide source attribution so users can verify claims.

Common challenges with RAG include: poor retrieval quality when queries are ambiguous, the "lost in the middle" problem where models ignore context in the middle of long prompts, and the tendency of models to still hallucinate even when correct context is provided. These challenges have led to the development of "self-healing" RAG systems that evaluate and improve their own outputs.`,
      },
      {
        title: "Self-Healing RAG Architecture",
        content: `Self-Healing RAG is an advanced architecture that adds a self-evaluation loop to the standard RAG pipeline. While traditional RAG follows a linear flow of retrieve-then-generate, self-healing RAG introduces a "critic" agent that evaluates the generated answer for accuracy and grounding.

The pipeline works in a cyclical manner: First, relevant document chunks are retrieved from the vector store using the user's query. Then, a generator LLM produces an answer using those chunks as context. Next, a separate critic LLM evaluates whether the answer is actually grounded in the retrieved chunks or if the model has hallucinated information.

If the critic rejects the answer, the system enters a "healing" phase. It can reformulate the original query to be more specific, retrieve new chunks using the refined query, and generate a new answer. This cycle continues until the critic accepts the answer or a maximum number of retries is reached.

The key advantage of this approach is that it significantly reduces the hallucination rate compared to standard RAG. Studies have shown that self-healing RAG can reduce hallucination rates from 15-20% down to 2-5% depending on the domain and configuration. The trade-off is increased latency and cost due to the additional critique and potential retry steps.

Implementation typically uses frameworks like LangGraph that support cyclical workflows with state management, allowing the pipeline to loop back to earlier steps based on the critic's evaluation.`,
      },
      {
        title: "Evaluation Metrics for RAG Systems",
        content: `Evaluating RAG systems requires metrics that go beyond traditional NLP measures. The most important metrics fall into three categories: retrieval quality, generation quality, and end-to-end performance.

For retrieval quality, the key metrics are: Recall@K (what fraction of relevant documents are in the top-K results), Precision@K (what fraction of the top-K results are actually relevant), and Mean Reciprocal Rank (the average of the reciprocal ranks of the first relevant result). These metrics require a labeled dataset of query-document relevance pairs.

For generation quality, faithfulness is the most critical metric - it measures whether the generated answer is actually supported by the retrieved context. Other important metrics include answer relevancy (is the answer actually addressing the question), context precision (are the retrieved chunks useful for answering), and context recall (did the retrieval step find enough relevant information).

The RAGAS framework (Retrieval Augmented Generation Assessment) provides automated evaluation for all these metrics. It uses a separate LLM call to judge faithfulness, answer relevancy, and other criteria. DeepEval and TruLens are alternative frameworks that offer similar capabilities.

A practical evaluation strategy is to maintain a "golden dataset" of 100+ question-answer pairs with expected outputs and edge cases. This dataset should include straightforward factual questions, ambiguous queries, questions outside the knowledge base scope, and adversarial queries designed to provoke hallucination. Running this eval set as part of a CI/CD pipeline ensures that RAG quality doesn't regress as the system evolves.`,
      },
    ];

    for (const doc of sampleDocs) {
      await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(doc),
      });
    }
    toast.success("3 sample documents loaded");
    fetchDocuments();
  };

  // ── Keyboard shortcut ──
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleQuery();
    }
  };

  // ── Render ──
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Brain className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Self-Healing RAG
              </h1>
              <p className="text-xs text-muted-foreground">
                Retrieve. Generate. Critique. Heal.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className="text-xs font-mono border-emerald-500/30 text-emerald-400"
            >
              <Database className="w-3 h-3 mr-1" />
              {totalChunks} chunks
            </Badge>
            <Badge
              variant="outline"
              className="text-xs font-mono border-violet-500/30 text-violet-400"
            >
              <FileText className="w-3 h-3 mr-1" />
              {documents.length} docs
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ─── Left Panel: Knowledge Base ─── */}
          <aside className="lg:col-span-4 xl:col-span-3 space-y-4">
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Database className="w-4 h-4 text-sky-400" />
                    Knowledge Base
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-foreground h-7"
                    onClick={loadSampleData}
                  >
                    <Zap className="w-3 h-3 mr-1" />
                    Load Samples
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* File upload dropzone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`relative flex flex-col items-center justify-center gap-1.5 p-4 rounded-lg border-2 border-dashed transition-all duration-200 ${
                    isDragging
                      ? "border-emerald-400 bg-emerald-500/5"
                      : "border-border/50"
                  }`}
                >
                  <FileUp className={`w-5 h-5 ${isDragging ? "text-emerald-400" : "text-muted-foreground/50"}`} />
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">
                      {isDragging ? "Drop file here" : "Drag & drop files here"}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      .txt, .md, .csv, .json, .html
                    </p>
                  </div>
                </div>
                {/* Browse button — separate from the dropzone */}
                <label className="block">
                  <input
                    type="file"
                    accept=".txt,.md,.csv,.json,.html,.xml"
                    multiple
                    className="hidden"
                    onChange={onFileInputChange}
                  />
                  <span
                    className={`flex items-center justify-center gap-1.5 w-full py-1.5 rounded-md text-xs font-medium border border-border/50 bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors ${uploadingFileName ? "pointer-events-none opacity-60" : ""}`}
                  >
                    {uploadingFileName ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {"Uploading "}{uploadingFileName}{"..."}
                      </>
                    ) : (
                      <>
                        <Upload className="w-3 h-3" />
                        Browse Files
                      </>
                    )}
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  <Separator className="flex-1" />
                  <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">or paste text</span>
                  <Separator className="flex-1" />
                </div>

                <Input
                  placeholder="Document title (optional for file uploads)..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="h-8 text-sm bg-background/50"
                />
                <Textarea
                  placeholder="Paste document content here..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="min-h-[100px] text-sm bg-background/50 resize-none"
                />
                <Button
                  size="sm"
                  className="w-full h-8 text-xs"
                  onClick={handleUpload}
                  disabled={isUploading || !newTitle.trim() || !newContent.trim()}
                >
                  {isUploading ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Upload className="w-3 h-3 mr-1" />
                  )}
                  Upload & Chunk
                </Button>
              </CardContent>
            </Card>

            {/* Document List */}
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Uploaded Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                {documents.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No documents yet. Upload some content or load samples.
                  </p>
                ) : (
                  <ScrollArea className="max-h-64">
                    <div className="space-y-2">
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-2 rounded-md bg-background/50 border border-border/30 group"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">
                              {doc.title}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {doc.chunkCount} chunks
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                            onClick={() => handleDelete(doc.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </aside>

          {/* ─── Right Panel: Query & Results ─── */}
          <section className="lg:col-span-8 xl:col-span-9 space-y-4">
            {/* Query Input */}
            <Card className="bg-card/50 border-border/50">
              <CardContent className="pt-4 pb-4">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Textarea
                      ref={queryInputRef}
                      placeholder="Ask a question about your knowledge base..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={isQuerying}
                      className="min-h-[48px] max-h-[120px] text-sm bg-background/50 resize-none pr-12"
                      rows={1}
                    />
                    <Button
                      size="sm"
                      className="absolute right-2 bottom-2 h-7 w-7 p-0"
                      onClick={handleQuery}
                      disabled={isQuerying || !query.trim()}
                    >
                      {isQuerying ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Search className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Press Enter to query. The pipeline will retrieve, generate,
                  critique, and self-heal if needed.
                </p>
              </CardContent>
            </Card>

            {/* Pipeline Visualization */}
            {isQuerying && (
              <Card className="bg-card/50 border-border/50 overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Eye className="w-4 h-4 text-violet-400" />
                    Pipeline Status
                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PipelineVisualization activeStep={activeStep} />
                </CardContent>
              </Card>
            )}

            {/* Result */}
            {result && (
              <>
                {/* Status Bar */}
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge
                    variant="outline"
                    className={
                      result.status === "accepted"
                        ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/5"
                        : result.status === "fallback"
                          ? "border-red-500/30 text-red-400 bg-red-500/5"
                          : "border-amber-500/30 text-amber-400 bg-amber-500/5"
                    }
                  >
                    {result.status === "accepted" && (
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                    )}
                    {result.status === "fallback" && (
                      <AlertTriangle className="w-3 h-3 mr-1" />
                    )}
                    {result.status === "max_retries" && (
                      <XCircle className="w-3 h-3 mr-1" />
                    )}
                    {result.status.toUpperCase()}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-xs font-mono border-border/50 text-muted-foreground"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    {result.iterations} iteration{result.iterations !== 1 ? "s" : ""}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-xs font-mono border-border/50 text-muted-foreground"
                  >
                    <Clock className="w-3 h-3 mr-1" />
                    {result.latencyMs}ms
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-xs font-mono border-border/50 text-muted-foreground"
                  >
                    <Database className="w-3 h-3 mr-1" />
                    {result.retrievedChunks.length} chunks
                  </Badge>
                </div>

                {/* Pipeline Event Log */}
                <Card className="bg-card/50 border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      Pipeline Trace
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {result.events
                        .filter(
                          (e, i, arr) =>
                            arr.findIndex(
                              (x) =>
                                x.step === e.step &&
                                x.iteration === e.iteration
                            ) === i
                        )
                        .map((event, idx) => {
                          const config = STEP_CONFIG[event.step] || {
                            icon: <Zap className="w-4 h-4" />,
                            color: "text-muted-foreground",
                            label: event.step,
                          };
                          return (
                            <div key={idx} className="flex items-start gap-3">
                              <div
                                className={`mt-0.5 p-1 rounded-md bg-background/80 ${config.color}`}
                              >
                                {config.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-xs font-medium ${config.color}`}
                                  >
                                    {config.label}
                                  </span>
                                  {event.iteration > 0 && (
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                      #{event.iteration}
                                    </span>
                                  )}
                                </div>
                                {event.detail && (
                                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                                    {event.detail}
                                  </p>
                                )}
                                {event.critique && (
                                  <div className="mt-1.5 p-2 rounded-md bg-background/50 border border-border/30">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span
                                        className={`text-[10px] font-medium ${
                                          event.critique.grounded
                                            ? "text-emerald-400"
                                            : "text-red-400"
                                        }`}
                                      >
                                        {event.critique.grounded
                                          ? "GROUNDED"
                                          : "NOT GROUNDED"}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground font-mono">
                                        confidence: {Math.round(event.critique.confidence * 100)}%
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                                      {event.critique.reason}
                                    </p>
                                  </div>
                                )}
                              </div>
                              {idx <
                                result.events.filter(
                                  (e, i, arr) =>
                                    arr.findIndex(
                                      (x) =>
                                        x.step === e.step &&
                                        x.iteration === e.iteration
                                    ) === i
                                ).length -
                                  1 && (
                                  <ArrowRight className="w-3 h-3 text-muted-foreground/50 mt-1 shrink-0" />
                                )}
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>

                {/* Retrieved Chunks (collapsible) */}
                {result.retrievedChunks.length > 0 && (
                  <Card className="bg-card/50 border-border/50">
                    <button
                      className="w-full flex items-center justify-between p-4 pb-2 text-left"
                      onClick={() => setShowChunks(!showChunks)}
                    >
                      <span className="text-sm font-medium flex items-center gap-2">
                        <FileText className="w-4 h-4 text-sky-400" />
                        Retrieved Chunks
                        <span className="text-[10px] text-muted-foreground font-mono">
                          ({result.retrievedChunks.length})
                        </span>
                      </span>
                      {showChunks ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                    {showChunks && (
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          {result.retrievedChunks.map((chunk, idx) => (
                            <div
                              key={chunk.id}
                              className="p-3 rounded-md bg-background/50 border border-border/30"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  Chunk #{idx + 1} (index: {chunk.chunkIndex})
                                </span>
                                <span className="text-[10px] font-mono text-sky-400">
                                  score: {chunk.score.toFixed(3)}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
                                {chunk.text}
                              </p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                )}

                {/* Final Answer */}
                <Card
                  ref={answerRef}
                  className="bg-card/50 border-emerald-500/20"
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      Answer
                      {result.status === "accepted" && (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/5"
                        >
                          Verified
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">
                      {result.answer}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Empty State */}
            {!result && !isQuerying && (
              <Card className="bg-card/30 border-border/30 border-dashed">
                <CardContent className="py-16 text-center">
                  <Brain className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Upload documents and ask a question to see the self-healing
                    pipeline in action.
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    The pipeline retrieves relevant chunks, generates an answer,
                    critiques it for hallucinations, and retries if needed.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Query History */}
            {queryHistory.length > 0 && (
              <Card className="bg-card/50 border-border/50">
                <button
                  className="w-full flex items-center justify-between p-4 pb-2 text-left"
                  onClick={() => setShowHistory(!showHistory)}
                >
                  <span className="text-sm font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    Query History
                    <span className="text-[10px] text-muted-foreground font-mono">
                      ({queryHistory.length})
                    </span>
                  </span>
                  {showHistory ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
                {showHistory && (
                  <CardContent className="pt-0">
                    <ScrollArea className="max-h-60">
                      <div className="space-y-2">
                        {queryHistory.map((log) => (
                          <div
                            key={log.id}
                            className="p-2.5 rounded-md bg-background/50 border border-border/30 cursor-pointer hover:bg-background/80 transition-colors"
                            onClick={() => {
                              setQuery(log.query);
                              queryInputRef.current?.focus();
                            }}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs font-medium truncate max-w-[70%]">
                                {log.query}
                              </p>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={`text-[9px] h-4 px-1.5 ${
                                    log.status === "accepted"
                                      ? "border-emerald-500/30 text-emerald-400"
                                      : "border-amber-500/30 text-amber-400"
                                  }`}
                                >
                                  {log.status}
                                </Badge>
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  {log.latencyMs}ms
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                )}
              </Card>
            )}
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <p className="text-[10px] text-muted-foreground text-center">
            Self-Healing RAG Pipeline — A RAG system that critiques its own
            output and retries | Built with Next.js, Prisma, TF-IDF Retrieval
          </p>
        </div>
      </footer>
    </div>
  );
}

// ─── Pipeline Visualization Component ────────────────────────────────

function PipelineVisualization({
  activeStep,
}: {
  activeStep: string | null;
}) {
  const steps = ["retrieving", "generating", "critiquing", "accepted"];

  const getStepState = (step: string) => {
    if (step === activeStep) return "active";
    const currentIdx = steps.indexOf(activeStep || "");
    const stepIdx = steps.indexOf(step);
    if (stepIdx < currentIdx) return "completed";
    return "pending";
  };

  return (
    <div className="flex items-center justify-between gap-2 px-2">
      {steps.map((step, idx) => {
        const state = getStepState(step);
        const config = STEP_CONFIG[step];
        return (
          <div key={step} className="flex items-center gap-2 flex-1">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                state === "active"
                  ? "bg-primary/10 border border-primary/20 text-primary"
                  : state === "completed"
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                    : "bg-muted/30 border border-border/20 text-muted-foreground/40"
              }`}
            >
              {state === "active" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : state === "completed" ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : (
                <span className="w-3 h-3">{config?.icon}</span>
              )}
              {config?.label || step}
            </div>
            {idx < steps.length - 1 && (
              <ArrowRight
                className={`w-3 h-3 shrink-0 transition-colors ${
                  state === "completed"
                    ? "text-emerald-400/50"
                    : "text-muted-foreground/20"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}