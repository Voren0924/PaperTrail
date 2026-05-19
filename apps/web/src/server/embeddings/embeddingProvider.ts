export const EMBEDDING_DIMENSIONS = 1536;
export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
export const DEFAULT_EMBEDDING_PROVIDER = "openai-compatible";
export const DEFAULT_EMBEDDING_BATCH_SIZE = 32;

export type EmbeddingProvider = {
  name: string;
  model: string;
  dimensions: number;
  embedTexts(texts: string[]): Promise<EmbeddingProviderResult>;
};

export type EmbeddingProviderResult = {
  model: string;
  embeddings: number[][];
};

export type EmbeddingProviderConfig = {
  provider: string;
  baseUrl: string;
  credential: string;
  model: string;
  dimensions: number;
};

export class EmbeddingProviderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "EmbeddingProviderError";
  }
}

export class EmbeddingConfigurationError extends EmbeddingProviderError {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddingConfigurationError";
  }
}

export class EmbeddingDimensionError extends EmbeddingProviderError {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddingDimensionError";
  }
}

export function getEmbeddingProviderConfig(
  env: Record<string, string | undefined> = process.env
): EmbeddingProviderConfig {
  const provider = env.EMBEDDING_PROVIDER ?? DEFAULT_EMBEDDING_PROVIDER;
  const baseUrl = env.EMBEDDING_BASE_URL ?? "https://api.openai.com/v1";
  const credential = env.EMBEDDING_API_KEY ?? "";
  const model = env.EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL;
  const dimensions = parseEmbeddingDimensions(env.EMBEDDING_DIMENSIONS);

  if (provider !== DEFAULT_EMBEDDING_PROVIDER) {
    throw new EmbeddingConfigurationError(`Unsupported embedding provider: ${provider}.`);
  }

  if (!credential) {
    throw new EmbeddingConfigurationError("EMBEDDING_API_KEY is required for embeddings.");
  }

  return {
    provider,
    baseUrl,
    credential,
    model,
    dimensions
  };
}

export function parseEmbeddingDimensions(rawValue: string | undefined): number {
  if (!rawValue) {
    return EMBEDDING_DIMENSIONS;
  }

  const dimensions = Number(rawValue);

  if (!Number.isInteger(dimensions) || dimensions <= 0) {
    throw new EmbeddingConfigurationError("EMBEDDING_DIMENSIONS must be a positive integer.");
  }

  if (dimensions !== EMBEDDING_DIMENSIONS) {
    throw new EmbeddingConfigurationError(
      `EMBEDDING_DIMENSIONS must match the PaperChunk.embedding vector(${EMBEDDING_DIMENSIONS}) column.`
    );
  }

  return dimensions;
}

export function assertEmbeddingDimensions(embedding: number[], expectedDimensions: number): void {
  if (embedding.length !== expectedDimensions) {
    throw new EmbeddingDimensionError(
      `Embedding dimension mismatch: expected ${expectedDimensions}, received ${embedding.length}.`
    );
  }
}
