# Grounded Answering And Chat Provider

Desktop MVP update: chat provider configuration now comes from local Settings (`providerBaseUrl`, `providerApiKey`, `chatModel`, and `embeddingModel`). The MVP no longer requires `CHAT_API_KEY` or login/session state for the core chat flow.

Thread G adds the backend chat foundation for citation-grounded answers. It uses Thread F retrieval as its only evidence source and does not implement frontend UI.

## Configuration

Chat model configuration is separate from embedding configuration:

```text
CHAT_PROVIDER=openai-compatible
CHAT_BASE_URL=https://api.openai.com/v1
CHAT_API_KEY=
CHAT_MODEL=gpt-4o-mini
```

`CHAT_API_KEY` must be set only in local or deployment environment files that are not committed. Provider calls happen server-side in the route/service layer.

The OpenAI-compatible provider calls:

```text
POST <CHAT_BASE_URL>/chat/completions
```

The same provider shape can be pointed at compatible APIs later by changing `CHAT_BASE_URL` and `CHAT_MODEL`. DeepSeek-specific branching is intentionally not included.

## API

`POST /api/chat`

Request:

```json
{
  "question": "What is the paper's method?",
  "paperId": "paper-uuid",
  "chatSessionId": "optional-chat-session-uuid",
  "scopeType": "PAPER"
}
```

`paperIds` can be supplied instead of `paperId` for selected-paper scope:

```json
{
  "question": "Compare the evidence.",
  "paperIds": ["paper-uuid-1", "paper-uuid-2"],
  "scopeType": "COLLECTION"
}
```

Response:

```json
{
  "answer": "Grounded answer text.",
  "insufficientEvidence": false,
  "citations": [
    {
      "paperId": "paper-uuid",
      "chunkId": "chunk-uuid",
      "pageStart": 2,
      "pageEnd": 3,
      "sectionTitle": "Method",
      "text": "Full retrieved chunk text.",
      "similarityScore": 0.91,
      "label": "[paper-uuid, pp. 2-3]",
      "quote": "Short quote preview."
    }
  ],
  "chatSessionId": "chat-session-uuid",
  "assistantMessageId": "assistant-message-uuid"
}
```

## Grounding Behavior

The answer service:

1. Validates the selected paper scope belongs to the current user.
2. Requires all selected papers to be `READY`.
3. Persists the user message.
4. Calls Thread F retrieval for relevant chunks.
5. Returns an insufficient-evidence response without calling the chat provider when retrieval returns no chunks.
6. Builds a prompt with system instructions, user question, and evidence chunks that include chunk IDs.
7. Requires JSON output with `answer`, `insufficientEvidence`, and `citedClaims`.
8. Rejects citations for chunks that were not retrieved.
9. Retries once when the provider returns invalid or missing citations.
10. Persists the assistant message, citations, cited claims, and retrieval metadata.

The model is instructed not to use outside knowledge for paper-specific factual claims.

## Persistence

The implementation uses existing tables:

- `ChatSession`
- `ChatSessionPaper`
- `ChatMessage`
- `ChatCitation`
- `ChatCitedClaim`

No schema migration is required for Thread G.

## Limitations

- Citation labels currently use paper ID and page range because richer author/title citation formatting is not yet exposed by retrieval.
- Structured cited-claim mapping is deterministic after provider output validation, but claim text still comes from the provider JSON.
- Full end-to-end persistence tests against PostgreSQL can be added once a test database convention exists. Current tests use in-memory repositories and mocked providers/retrieval.
