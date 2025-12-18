import React, { useEffect, useMemo, useState } from 'react';
import { FileSearch, MessageSquare, ShieldAlert, Sparkles, Loader2 } from 'lucide-react';

const devOnly = import.meta.env.DEV;

function SectionCard({ title, icon: Icon, children, action }) {
  return (
    <section className="bg-surface border border-accent rounded-xl shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function DevAssistant() {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text:
        'I am the TonPlaygram dev assistant. Ask me about any part of the repo, and I will search the local codebase, surface matches with line numbers, and let you inspect full files. This tool is only active in local development and indexes the repository directly from disk.'
    }
  ]);
  const [searchResults, setSearchResults] = useState([]);
  const [filesIndexed, setFilesIndexed] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!devOnly) return;
    const loadIndex = async () => {
      try {
        const res = await fetch('/api/dev-assistant/index');
        const data = await res.json();
        setFilesIndexed(data.files || []);
      } catch (err) {
        setError('Failed to load the code index. Make sure the Vite dev server is running.');
      }
    };
    loadIndex();
  }, []);

  const askAssistant = async (event) => {
    event.preventDefault();
    if (!query.trim()) return;
    setError('');
    const userMessage = { role: 'user', text: query.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setLoadingSearch(true);

    try {
      const res = await fetch(`/api/dev-assistant/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      setSearchResults(data.results || []);

      const summary = buildSummaryResponse(query.trim(), data.results || [], data.scanned || 0);
      setMessages((prev) => [...prev, { role: 'assistant', text: summary }]);
    } catch (err) {
      setError('Search failed. Verify the dev server is running and try again.');
    } finally {
      setLoadingSearch(false);
    }
  };

  const openFile = async (relativePath) => {
    setSelectedFile(relativePath);
    setLoadingFile(true);
    setError('');
    try {
      const res = await fetch(`/api/dev-assistant/file?path=${encodeURIComponent(relativePath)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFileContent(data.content || '');
    } catch (err) {
      setError('Unable to read file. The path may be missing or outside the repo.');
    } finally {
      setLoadingFile(false);
    }
  };

  const filteredFiles = useMemo(() => {
    if (!query.trim()) return filesIndexed;
    return filesIndexed.filter((file) => file.toLowerCase().includes(query.trim().toLowerCase()));
  }, [filesIndexed, query]);

  if (!devOnly) {
    return (
      <div className="max-w-4xl mx-auto bg-surface border border-accent rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3 text-amber-500">
          <ShieldAlert className="w-6 h-6" />
          <h1 className="text-xl font-semibold">Dev assistant unavailable</h1>
        </div>
        <p className="text-text/80">
          This assistant is restricted to developer builds. Start the Vite dev server locally to enable
          repository-aware search and file inspection.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-surface border border-accent rounded-xl shadow-sm p-6 space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-bold">TonPlaygram Dev Assistant</h1>
        </div>
        <p className="text-text/80">
          Private, repo-aware helper for developers. I scan the local file system (no network calls) and respond with
          file matches and content previews so you can test games and the webapp quickly.
        </p>
      </div>

      {error && (
        <div className="bg-rose-100 text-rose-900 border border-rose-300 rounded-lg p-3">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <SectionCard title="Ask the assistant" icon={MessageSquare}
            action={loadingSearch && <Loader2 className="w-5 h-5 animate-spin text-accent" />}>
            <form onSubmit={askAssistant} className="space-y-3">
              <label className="text-sm text-text/70">Describe what you want to inspect</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for a component, hook, or keyword..."
                  className="flex-1 rounded-lg border border-accent bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 bg-accent text-background font-semibold px-4 py-2 rounded-lg shadow hover:shadow-md transition"
                  disabled={loadingSearch}
                >
                  <FileSearch className="w-5 h-5" />
                  {loadingSearch ? 'Searching…' : 'Search code'}
                </button>
              </div>
            </form>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {messages.map((msg, idx) => (
                <div
                  key={`${msg.role}-${idx}`}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    msg.role === 'assistant'
                      ? 'bg-background border border-accent/60'
                      : 'bg-accent/20 border border-accent'
                  }`}
                >
                  <div className="font-semibold mb-1">
                    {msg.role === 'assistant' ? 'Assistant' : 'You'}
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed text-text/90">{msg.text}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Search matches" icon={Sparkles}>
            {loadingSearch && (
              <div className="flex items-center gap-2 text-text/80">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Scanning repository…</span>
              </div>
            )}
            {!loadingSearch && !searchResults.length && (
              <p className="text-text/70">No matches yet. Ask a question or search for a keyword.</p>
            )}
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {searchResults.map((result) => (
                <div key={result.path} className="border border-accent rounded-lg p-3 bg-background">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm text-accent break-all">{result.path}</p>
                    <button
                      type="button"
                      onClick={() => openFile(result.path)}
                      className="text-sm text-accent underline"
                    >
                      Open
                    </button>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm text-text/80">
                    {result.matches.map((match) => (
                      <li key={`${result.path}-${match.lineNumber}`} className="font-mono">
                        <span className="text-accent mr-2">{match.lineNumber}.</span>
                        {match.line}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="File index" icon={FileSearch}
            action={<span className="text-xs text-text/60">{filesIndexed.length} files</span>}>
            <p className="text-sm text-text/70">
              Filtered by your query. Tap a file to preview its contents directly from disk.
            </p>
            <div className="max-h-72 overflow-y-auto border border-accent/40 rounded-lg divide-y divide-accent/30 bg-background">
              {filteredFiles.map((file) => (
                <button
                  type="button"
                  key={file}
                  onClick={() => openFile(file)}
                  className="w-full text-left px-3 py-2 hover:bg-accent/10 text-sm break-all"
                >
                  {file}
                </button>
              ))}
              {!filteredFiles.length && (
                <p className="px-3 py-2 text-sm text-text/70">No files match this query.</p>
              )}
            </div>
          </SectionCard>

          <SectionCard title="File preview" icon={MessageSquare}
            action={loadingFile && <Loader2 className="w-5 h-5 animate-spin text-accent" />}>
            {selectedFile ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold break-all text-accent">{selectedFile}</p>
                <pre className="bg-background border border-accent rounded-lg p-3 text-xs overflow-auto max-h-72 whitespace-pre-wrap">
                  {loadingFile ? 'Loading…' : fileContent || 'File is empty.'}
                </pre>
              </div>
            ) : (
              <p className="text-text/70 text-sm">Select a file from the index or from search results to preview it.</p>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function buildSummaryResponse(query, results, scannedCount) {
  if (!results.length) {
    return `No matches for "${query}" across ${scannedCount} files. Try a different keyword or a smaller phrase.`;
  }

  const lines = results.slice(0, 5).map((result) => {
    const locations = result.matches.map((m) => m.lineNumber).join(', ');
    return `• ${result.path} (lines ${locations})`;
  });

  return [
    `I scanned ${scannedCount} files and found ${results.length} match(es) for "${query}":`,
    ...lines,
    'Open a result to read the full source or refine your query to narrow the context.'
  ].join('\n');
}
