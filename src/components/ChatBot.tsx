import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Sparkles, X } from "lucide-react";

export function ChatBot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, status]);

  const isBusy = status === "submitted" || status === "streaming";

  const submit = (text?: string) => {
    const value = (text ?? input).trim();
    if (!value || isBusy) return;
    setInput("");
    sendMessage({ text: value });
  };

  const suggestions = [
    "What's new in the Pi ecosystem I should ship next?",
    "Draft an FOB soybean contract, 10,000 MT, US → China, 45,000 π",
    "Explain Incoterms 2020 changes for me",
    "Ideas to modernize PiTrade with AI this quarter",
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close PiTrade Copilot" : "Open PiTrade Copilot"}
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--color-accent,#c9a24b)] text-[#0b1c3a] shadow-2xl shadow-black/30 transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-40 flex h-[min(640px,80vh)] w-[min(400px,92vw)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b1c3a] text-white shadow-2xl">
          <header className="flex items-center gap-2 border-b border-white/10 bg-black/20 px-4 py-3">
            <MessageCircle className="h-4 w-4 text-[color:var(--color-accent,#c9a24b)]" />
            <div className="flex-1">
              <p className="text-sm font-semibold">PiTrade Copilot</p>
              <p className="text-[11px] text-white/60">
                Live trade & Pi ecosystem updates
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-white/70 hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm"
          >
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-white/80">
                  Hi — I&apos;m PiTrade Copilot. Ask me to draft contracts, or
                  surface fresh Pi Network & trade-tech ideas tailored to your
                  app.
                </p>
                <div className="grid gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => submit(s)}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-white/80 transition hover:bg-white/10"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === "user"
                    ? "ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-[color:var(--color-accent,#c9a24b)] px-3 py-2 text-[#0b1c3a]"
                    : "mr-auto max-w-[90%] rounded-2xl rounded-bl-sm bg-white/10 px-3 py-2 text-white"
                }
              >
                {m.parts?.map((part, i) => {
                  if (part.type === "text") {
                    return (
                      <p
                        key={i}
                        className="whitespace-pre-wrap text-sm leading-relaxed"
                      >
                        {part.text}
                      </p>
                    );
                  }
                  if (part.type?.startsWith("tool-")) {
                    const p = part as {
                      type: string;
                      state?: string;
                      output?: unknown;
                    };
                    const name = p.type.replace(/^tool-/, "");
                    return (
                      <div
                        key={i}
                        className="mt-2 rounded-lg border border-white/20 bg-black/20 p-2 text-[11px] text-white/80"
                      >
                        <div className="mb-1 font-mono uppercase tracking-wider text-white/60">
                          🛠 {name} · {p.state ?? "…"}
                        </div>
                        {p.output !== undefined && (
                          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px]">
                            {typeof p.output === "string"
                              ? p.output
                              : JSON.stringify(p.output, null, 2)}
                          </pre>
                        )}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            ))}

            {isBusy && (
              <div className="mr-auto flex items-center gap-1 rounded-2xl bg-white/10 px-3 py-2 text-white/70">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/70" />
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/70"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/70"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            )}

            {error && (
              <p className="rounded-lg bg-red-500/20 px-3 py-2 text-xs text-red-100">
                {error.message}
              </p>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex items-end gap-2 border-t border-white/10 bg-black/20 p-3"
          >
            <label htmlFor="pitrade-chat-input" className="sr-only">
              Ask PiTrade Copilot
            </label>
            <textarea
              id="pitrade-chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder="Ask for updates or draft a contract…"
              className="max-h-32 flex-1 resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-[color:var(--color-accent,#c9a24b)] focus:outline-none"
            />
            <button
              type="submit"
              disabled={isBusy || !input.trim()}
              className="rounded-lg bg-[color:var(--color-accent,#c9a24b)] p-2 text-[#0b1c3a] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}