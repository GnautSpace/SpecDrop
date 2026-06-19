import { useState, useCallback, useEffect } from "react";
import {
  FileText,
  Key,
  Sparkles,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Zap,
  Target,
  CheckCircle2,
  Github,
  X,
  Eye,
  EyeOff,
  ClipboardPaste,
  TestTube,
} from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface Ticket {
  title: string;
  userStory: string;
  acceptanceCriteria: string[];
  priority: "High" | "Medium" | "Low";
}

function App() {
  const [apiKey, setApiKey] = useState("");
  const [prd, setPrd] = useState("");
  const [githubUsername, setGithubUsername] = useState("");
  const [repoName, setRepoName] = useState("");
  const [githubPat, setGithubPat] = useState("");
  const [showPat, setShowPat] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pushingId, setPushingId] = useState<number | null>(null);

  // Load saved PAT from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("specdrop-github-pat");
    if (saved) setGithubPat(saved);
  }, []);

  // Initialize Pendo analytics
  useEffect(() => {
    const pendo = (window as any).pendo;
    if (pendo) {
      const visitorId = localStorage.getItem("specdrop-visitor-id") || `visitor-${Date.now()}`;
      localStorage.setItem("specdrop-visitor-id", visitorId);
      pendo.initialize({
        visitor: {
          id: visitorId,
          app: 'specdrop',
        },
      });
    }
  }, []);

  const savePat = (value: string) => {
    setGithubPat(value);
    if (value) {
      localStorage.setItem("specdrop-github-pat", value);
    } else {
      localStorage.removeItem("specdrop-github-pat");
    }
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  };

  const generateTickets = useCallback(async () => {
    if (!apiKey.trim()) {
      setError("Please enter your Gemini API key");
      return;
    }
    if (!prd.trim()) {
      setError("Please enter a PRD document");
      return;
    }

    setLoading(true);
    setError(null);
    setTickets([]);

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-tickets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Gemini-Key": apiKey,
        },
        body: JSON.stringify({ prd }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate tickets");
      }

      setTickets(data.tickets);
      (window as any).pendo?.track('tickets-generated', {
        ticketCount: data.tickets.length,
        prdLength: prd.length,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      (window as any).pendo?.track('ticket-generation-failed', {
        errorMessage,
        prdLength: prd.length,
      });
    } finally {
      setLoading(false);
    }
  }, [apiKey, prd]);

  const generateMarkdown = (ticket: Ticket): string => {
    return `# ${ticket.title}

**Priority:** ${ticket.priority}

## User Story

${ticket.userStory}

## Acceptance Criteria

${ticket.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}
`;
  };

  const pushToGitHub = async (ticket: Ticket, index: number) => {
    // Check if GitHub inputs are filled
    if (!githubUsername.trim() || !repoName.trim()) {
      showToast("Please enter your GitHub Username and Repository Name first!");
      return;
    }
    if (!githubPat.trim()) {
      showToast("Please enter your GitHub Personal Access Token first!");
      return;
    }

    setPushingId(index);

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/push-to-github`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ticket,
          owner: githubUsername,
          repo: repoName,
          pat: githubPat,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to push to GitHub");
      }

      showToast(`Ticket pushed successfully! Opened: ${data.filename}`);
      (window as any).pendo?.track('ticket-pushed-to-github', {
        ticketTitle: ticket.title,
        priority: ticket.priority,
        repo: repoName,
      });

      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to push to GitHub";
      showToast(errorMessage);
      (window as any).pendo?.track('github-push-failed', {
        errorMessage,
        ticketTitle: ticket.title,
        priority: ticket.priority,
        repo: repoName,
      });
    } finally {
      setPushingId(null);
    }
  };

  const copyToClipboard = async (ticket: Ticket, index: number) => {
    const text = `**${ticket.title}**
Priority: ${ticket.priority}

**User Story:**
${ticket.userStory}

**Acceptance Criteria:**
${ticket.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}`;

    await navigator.clipboard.writeText(text);
    setCopiedId(index);
    (window as any).pendo?.track('ticket-copied-to-clipboard', {
      ticketTitle: ticket.title,
      priority: ticket.priority,
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const priorityStyles = {
    High: "bg-rose-500/20 text-rose-400 border-rose-500/30",
    Medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    Low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-top duration-300">
          {toast.includes("Please enter") ? (
            <div className="bg-amber-900/90 border border-amber-500/50 rounded-xl px-6 py-4 shadow-xl shadow-amber-500/20 flex items-start gap-3 max-w-md">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-100 leading-relaxed">{toast}</p>
              <button onClick={() => setToast(null)} className="p-1 hover:bg-amber-800 rounded transition-colors flex-shrink-0">
                <X className="w-4 h-4 text-amber-300" />
              </button>
            </div>
          ) : (
            <div className="bg-emerald-900/90 border border-emerald-500/50 rounded-xl px-6 py-4 shadow-xl shadow-emerald-500/20 flex items-start gap-3 max-w-md">
              <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-100 leading-relaxed">{toast}</p>
              <button onClick={() => setToast(null)} className="p-1 hover:bg-emerald-800 rounded transition-colors flex-shrink-0">
                <X className="w-4 h-4 text-emerald-300" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">SpecDrop</h1>
              <p className="text-xs text-slate-400">PRD to Tickets, Instantly</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            {/* API Key Input */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Key className="w-4 h-4 text-slate-400" />
                <label className="text-sm font-medium text-slate-300">Gemini API Key</label>
              </div>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your API key from Google AI Studio"
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all"
              />
              <p className="mt-2 text-xs text-slate-500">
                Get your key at{" "}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  aistudio.google.com/apikey
                </a>
              </p>
            </div>

            {/* PRD Input */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-400" />
                  <label className="text-sm font-medium text-slate-300">Product Requirement Document</label>
                </div>
                <span className="text-xs text-slate-500">{prd.length} chars</span>
              </div>
              <textarea
                value={prd}
                onChange={(e) => setPrd(e.target.value)}
                placeholder="Paste your PRD here. Include features, user stories, requirements, and any relevant context..."
                rows={12}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all resize-none scrollbar-thin"
              />
            </div>

            {/* GitHub Target Repository */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Github className="w-4 h-4 text-slate-400" />
                <label className="text-sm font-medium text-slate-300">GitHub Target Repository</label>
              </div>
              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">GitHub Username or Org</label>
                  <input
                    type="text"
                    value={githubUsername}
                    onChange={(e) => setGithubUsername(e.target.value)}
                    placeholder="e.g., octocat"
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Repository Name</label>
                  <input
                    type="text"
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value)}
                    placeholder="e.g., specdrop-tickets"
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-slate-500">GitHub Personal Access Token</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text) {
                            savePat(text);
                            showToast("Token pasted from clipboard!");
                          }
                        } catch {
                          showToast("Could not access clipboard. Please paste manually.");
                        }
                      }}
                      className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
                      title="Paste from clipboard"
                    >
                      <ClipboardPaste className="w-3 h-3" />
                      Paste
                    </button>
                    <button
                      onClick={async () => {
                        if (!githubPat.trim()) {
                          showToast("Please enter a token first!");
                          return;
                        }
                        if (!githubUsername.trim() || !repoName.trim()) {
                          showToast("Please enter GitHub Username and Repository Name first!");
                          return;
                        }
                        setTestingConnection(true);
                        try {
                          const res = await fetch(`https://api.github.com/repos/${githubUsername}/${repoName}`, {
                            headers: { Authorization: `Bearer ${githubPat}`, "User-Agent": "SpecDrop" },
                          });
                          if (res.ok) {
                            showToast("Connection successful! Token works.");
                            (window as any).pendo?.track('github-connection-tested', {
                              connectionSuccess: true,
                              repo: repoName,
                            });
                          } else {
                            const data = await res.json().catch(() => ({}));
                            showToast(data.message || "Connection failed. Check your token and repo.");
                            (window as any).pendo?.track('github-connection-tested', {
                              connectionSuccess: false,
                              repo: repoName,
                            });
                          }
                        } catch {
                          showToast("Connection failed. Check your token and repo.");
                        } finally {
                          setTestingConnection(false);
                        }
                      }}
                      disabled={testingConnection}
                      className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1 disabled:text-slate-500"
                      title="Test connection"
                    >
                      {testingConnection ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <TestTube className="w-3 h-3" />
                      )}
                      {testingConnection ? "Testing..." : "Test"}
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type={showPat ? "text" : "password"}
                    value={githubPat}
                    onChange={(e) => savePat(e.target.value)}
                    placeholder="ghp_..."
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500/50 transition-all pr-10"
                  />
                  <button
                    onClick={() => setShowPat(!showPat)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    title={showPat ? "Hide token" : "Show token"}
                  >
                    {showPat ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Create a token with <span className="text-slate-400">repo</span> scope at{" "}
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    github.com/settings/tokens
                  </a>
                </p>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={generateTickets}
              disabled={loading || !apiKey.trim() || !prd.trim()}
              className="w-full py-4 px-6 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 disabled:shadow-none"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating Tickets...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Tickets
                </>
              )}
            </button>

            {/* Error */}
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-rose-400">Error</p>
                  <p className="text-sm text-rose-300/80 mt-1">{error}</p>
                </div>
              </div>
            )}
          </div>

          {/* Output Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                <Target className="w-5 h-5 text-cyan-400" />
                Generated Tickets
              </h2>
              {tickets.length > 0 && (
                <span className="text-sm text-slate-400">{tickets.length} tickets</span>
              )}
            </div>

            {tickets.length === 0 ? (
              <div className="bg-slate-900/30 border border-slate-800 rounded-xl p-12 text-center">
                <div className="w-16 h-16 mx-auto bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-slate-600" />
                </div>
                <p className="text-slate-500 text-sm">Your generated tickets will appear here</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {tickets.map((ticket, index) => (
                  <div
                    key={index}
                    className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xs font-mono text-slate-500">#{index + 1}</span>
                          <span
                            className={`text-xs font-medium px-2.5 py-1 rounded-full border ${priorityStyles[ticket.priority]}`}
                          >
                            {ticket.priority}
                          </span>
                        </div>
                        <h3 className="text-base font-semibold text-white group-hover:text-cyan-400 transition-colors">
                          {ticket.title}
                        </h3>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => pushToGitHub(ticket, index)}
                          disabled={pushingId === index}
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 text-slate-400 hover:text-white disabled:text-slate-500 transition-all flex items-center gap-1.5"
                          title="Push to GitHub"
                        >
                          {pushingId === index ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Github className="w-4 h-4" />
                          )}
                          <span className="text-xs font-medium hidden sm:inline">
                            {pushingId === index ? "Pushing..." : "Push"}
                          </span>
                        </button>
                        <button
                          onClick={() => copyToClipboard(ticket, index)}
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-all"
                          title="Copy to clipboard"
                        >
                          {copiedId === index ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">User Story</p>
                        <p className="text-sm text-slate-300 leading-relaxed">{ticket.userStory}</p>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                          Acceptance Criteria
                        </p>
                        <ul className="space-y-1.5">
                          {ticket.acceptanceCriteria.map((criteria, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                              <CheckCircle2 className="w-4 h-4 text-cyan-500 flex-shrink-0 mt-0.5" />
                              <span>{criteria}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-xs text-slate-600">
            SpecDrop - Transform your PRDs into actionable development tickets
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
