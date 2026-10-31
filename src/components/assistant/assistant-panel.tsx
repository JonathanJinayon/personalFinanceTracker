"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, Bot, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TigomMascot } from "@/components/assistant/tigom-mascot";
import type { AssistantMessage } from "@/components/assistant/assistant-types";

const suggestions = [
  "How much did I spend this month?",
  "Where does most of my money go?",
  "How close am I to my savings goals?",
  "Give me a summary of my finances.",
];

function mockReply(question: string) {
  const normalized = question.toLowerCase();
  if (normalized.includes("goal") || normalized.includes("save")) {
    return "Your savings goals are moving forward. This is a prototype response; I can offer goal insights once the assistant is connected to your financial data.";
  }
  if (normalized.includes("spend") || normalized.includes("money go")) {
    return "Your largest spending category in the sample data is Food. This is a mock insight and doesn't access or analyze live financial data.";
  }
  return "I’m here to help you make sense of your finances. TIGOM Assistant is currently a UI prototype and doesn’t access account data yet.";
}

export function AssistantPanel({ onClose, launcherPosition }: { onClose: () => void; launcherPosition: { x: number; y: number } }) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [draft, setDraft] = useState("");
  const messageEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages]);

  function sendMessage(text: string) {
    const content = text.trim();
    if (!content) return;
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content },
      { id: crypto.randomUUID(), role: "assistant", content: mockReply(content) },
    ]);
    setDraft("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(draft);
  }

  return (
    <section aria-label="TIGOM Assistant" style={{ left: `max(12px, min(${launcherPosition.x + 72 - 384}px, calc(100vw - 396px)))`, top: `max(12px, min(${launcherPosition.y - 520}px, calc(100svh - 540px)))` }} className="fixed z-[60] flex max-h-[min(38rem,calc(100svh-7rem))] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-2xl">
      <header className="flex items-center gap-3 border-b bg-muted/30 px-4 py-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 p-1.5">
          <TigomMascot title="TIGOM companion mascot" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-semibold">TIGOM Companion <Sparkles className="size-3.5 text-primary" /></span>
          <span className="mt-0.5 block text-xs text-muted-foreground">A little help with your money</span>
        </span>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close assistant"><X /></Button>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 p-1"><TigomMascot title="TIGOM" /></span>
          <p className="max-w-[88%] rounded-2xl rounded-tl-sm bg-muted px-3.5 py-3 text-sm leading-relaxed">Hi! I’m your TIGOM companion. Need help understanding your spending or savings?</p>
        </div>
        {messages.map((message) => (
          <div key={message.id} className={`flex items-start gap-2.5 ${message.role === "user" ? "justify-end" : ""}`}>
            {message.role === "assistant" ? <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 p-1"><TigomMascot title="TIGOM" /></span> : null}
            <p className={`max-w-[88%] rounded-2xl px-3.5 py-3 text-sm leading-relaxed ${message.role === "user" ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm bg-muted"}`}>{message.content}</p>
          </div>
        ))}
        <div ref={messageEndRef} />
      </div>

      {messages.length === 0 ? <div className="flex flex-wrap gap-2 px-4 pb-3">
        {suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => sendMessage(suggestion)} className="rounded-full border bg-background px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{suggestion}</button>)}
      </div> : null}

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t p-3">
        <Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask TIGOM…" aria-label="Message TIGOM Assistant" className="h-10 rounded-full px-4" />
        <Button type="submit" size="icon" className="size-10 rounded-full" disabled={!draft.trim()} aria-label="Send message"><ArrowUp /></Button>
      </form>
      <div className="flex items-center justify-center gap-1.5 border-t px-3 py-2 text-[10px] text-muted-foreground"><Bot className="size-3" />Prototype only · No financial data access</div>
    </section>
  );
}
