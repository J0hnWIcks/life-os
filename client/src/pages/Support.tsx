import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Send, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import { Card, PageHeader, EmptyState } from "../components/ui";

interface ChatMessage {
  role: "user" | "model";
  text: string;
}

const MODEL = "gemini-2.5-flash";

export default function Support() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.settings.get().then((s) => setApiKey(s.geminiApiKey || ""));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || !apiKey || sending) return;
    setError(null);
    const nextMessages: ChatMessage[] = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: nextMessages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
          }),
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const message = body?.error?.message || `Request failed (${res.status})`;
        throw new Error(message);
      }

      const data = await res.json();
      const replyText: string =
        data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") ||
        "(No response text was returned.)";
      setMessages((prev) => [...prev, { role: "model", text: replyText }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong reaching Gemini.");
    } finally {
      setSending(false);
    }
  }

  function clearChat() {
    setMessages([]);
    setError(null);
  }

  if (apiKey === null) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-8">
        <p className="text-sm text-dusk">Loading…</p>
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-8">
        <PageHeader title="Support" subtitle="A quick AI assistant, only when you need it." />
        <EmptyState
          icon={<Sparkles size={22} />}
          title="No Gemini API key connected yet"
          hint="Add a free key in Settings to start asking questions here."
          action={
            <Link to="/settings" className="text-xs font-medium text-moss hover:underline">
              Go to Settings →
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-4 py-8 sm:px-8">
      <PageHeader
        title="Support"
        subtitle="Ask anything, quickly — this conversation isn't saved anywhere."
        action={
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 rounded-md border border-dusk-light px-3 py-1.5 text-xs text-ink-soft hover:bg-fog"
          >
            <RotateCcw size={12} /> New conversation
          </button>
        }
      />

      <Card className="flex flex-1 flex-col overflow-hidden p-0">
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-5">
          {messages.length === 0 ? (
            <EmptyState
              icon={<Sparkles size={20} />}
              title="Ask me anything"
              hint="Quick questions, brainstorming, a second opinion — nothing here is saved once you leave."
            />
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-xl px-3.5 py-2.5 text-sm ${
                    m.role === "user" ? "bg-moss text-paper" : "bg-fog text-ink-soft"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))
          )}
          {sending && (
            <div className="flex items-center gap-2 text-xs text-dusk">
              <Loader2 size={13} className="animate-spin" /> Thinking…
            </div>
          )}
          {error && (
            <div className="rounded-md border border-ember/30 bg-ember-light px-3 py-2 text-xs text-ember">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-dusk-light p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask a question…"
            className="flex-1 rounded-lg border border-dusk-light px-3.5 py-2 text-sm outline-none focus:border-moss"
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            className="rounded-lg bg-moss p-2.5 text-paper hover:bg-moss/90 disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
      </Card>
    </div>
  );
}
