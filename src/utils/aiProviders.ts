// Supported paid AI providers (customer enters their own API key).
// DeepSeek + OpenAI share the OpenAI-compatible chat format; Claude uses its own.

export interface AIProvider {
  id: string;
  name: string;
  model: string;
  url: string;
  free?: boolean;
}

export const AI_PROVIDERS: AIProvider[] = [
  { id: 'pollinations', name: 'Free AI', model: 'openai', url: 'https://pollinations.ai', free: true },
  { id: 'deepseek', name: 'DeepSeek', model: 'deepseek-chat', url: 'https://platform.deepseek.com' },
  { id: 'openai', name: 'OpenAI', model: 'gpt-4o-mini', url: 'https://platform.openai.com' },
  { id: 'gemini', name: 'Gemini', model: 'gemini-2.0-flash', url: 'https://aistudio.google.com' },
  { id: 'anthropic', name: 'Claude', model: 'claude-3-5-haiku-20241022', url: 'https://console.anthropic.com' },
];

export function aiProviderById(id?: string | null): AIProvider {
  return AI_PROVIDERS.find((p) => p.id === id) || AI_PROVIDERS[0];
}
