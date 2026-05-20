"use client";

import type { FormEvent } from "react";
import { useState } from "react";

import { ApiClientError } from "@/lib/api";
import { askPaperQuestion } from "@/lib/chatApi";
import type { ChatCitation, Paper } from "@/lib/types";

import { Alert } from "./Alert";
import { Button } from "./Button";
import { CitationCard } from "./CitationCard";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  insufficientEvidence?: boolean;
  citations?: ChatCitation[];
};

type ChatPanelProps = {
  paper: Paper;
  disabledReason?: string | null;
  onCitations?: (citations: ChatCitation[]) => void;
  onSelectCitation?: (chunkId: string) => void;
};

export function ChatPanel({ paper, disabledReason, onCitations, onSelectCitation }: ChatPanelProps) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatSessionId, setChatSessionId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isDisabled = Boolean(disabledReason) || isSubmitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      setError("Enter a question about this paper.");
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmedQuestion
    };

    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await askPaperQuestion({
        paperId: paper.id,
        question: trimmedQuestion,
        chatSessionId
      });

      setChatSessionId(response.chatSessionId);
      onCitations?.(response.citations);
      setMessages((current) => [
        ...current,
        {
          id: response.assistantMessageId,
          role: "assistant",
          content: response.answer,
          insufficientEvidence: response.insufficientEvidence,
          citations: response.citations
        }
      ]);
    } catch (chatError) {
      setError(chatError instanceof ApiClientError ? chatError.message : "Unable to answer that question.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="chat-panel" aria-labelledby="chat-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Grounded chat</p>
          <h2 id="chat-title">Ask this paper</h2>
        </div>
      </div>
      {disabledReason ? <Alert tone="info">{disabledReason}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      <ChatTranscript messages={messages} paper={paper} onSelectCitation={onSelectCitation} />
      {isSubmitting ? <p className="muted" role="status">Waiting for grounded answer...</p> : null}
      <form className="chat-form" onSubmit={(event) => void handleSubmit(event)}>
        <label htmlFor="question">Question</label>
        <textarea
          id="question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          disabled={isDisabled}
          rows={4}
          placeholder="What is the main contribution?"
        />
        <Button type="submit" disabled={isDisabled}>
          Ask
        </Button>
      </form>
    </section>
  );
}

export function ChatTranscript({
  messages,
  paper,
  onSelectCitation
}: {
  messages: ChatMessage[];
  paper: Pick<Paper, "title" | "originalFileName">;
  onSelectCitation?: (chunkId: string) => void;
}) {
  if (messages.length === 0) {
    return <p className="empty-inline">Ask a question once the paper is ready. Answers will include backend citations.</p>;
  }

  return (
    <div className="chat-transcript">
      {messages.map((message) => (
        <article className={`chat-message chat-message--${message.role}`} key={message.id}>
          <span>{message.role === "user" ? "You" : "PaperTrail"}</span>
          <p>{message.content}</p>
          {message.insufficientEvidence ? (
            <Alert tone="warning">The backend reported insufficient retrieved evidence for this answer.</Alert>
          ) : null}
          {message.citations?.length ? (
            <div className="citation-list">
              {message.citations.map((citation) => (
                <CitationCard
                  key={citation.chunkId}
                  citation={citation}
                  paper={paper}
                  onSelect={onSelectCitation}
                />
              ))}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
