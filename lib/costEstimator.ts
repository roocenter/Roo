const COST_PER_MILLION: Record<string, { in: number; out: number; label: string; short: string; color: string }> = {
  'openai/gpt-5.2': { in: 2.5, out: 10, label: 'gpt-5.2', short: 'gpt-5.2', color: '#3b82f6' },
  'gpt-5.2': { in: 2.5, out: 10, label: 'gpt-5.2', short: 'gpt-5.2', color: '#3b82f6' },
  'openai-codex/gpt-5.3-codex': {
    in: 3,
    out: 12,
    label: 'codex-5.3',
    short: 'codex-5.3',
    color: '#7c3aed',
  },
  'gpt-5.3-codex': {
    in: 3,
    out: 12,
    label: 'codex-5.3',
    short: 'codex-5.3',
    color: '#7c3aed',
  },
  'anthropic/claude-sonnet-4-6': {
    in: 3,
    out: 15,
    label: 'claude-sonnet',
    short: 'claude-sonnet',
    color: '#f97316',
  },
  'claude-sonnet-4-6': {
    in: 3,
    out: 15,
    label: 'claude-sonnet',
    short: 'claude-sonnet',
    color: '#f97316',
  },
  'openai-codex/gpt-5.1-codex-mini': {
    in: 0.3,
    out: 1.2,
    label: 'codex-mini',
    short: 'codex-mini',
    color: '#22c55e',
  },
  'gpt-5.1-codex-mini': {
    in: 0.3,
    out: 1.2,
    label: 'codex-mini',
    short: 'codex-mini',
    color: '#22c55e',
  },
};

export type KnownModel = keyof typeof COST_PER_MILLION;

export const MODEL_ORDER: KnownModel[] = [
  'openai/gpt-5.2',
  'openai-codex/gpt-5.3-codex',
  'anthropic/claude-sonnet-4-6',
  'openai-codex/gpt-5.1-codex-mini',
];

export function estimateCostUSD(model: string, tokensIn: number, tokensOut: number): number {
  const pricing = COST_PER_MILLION[model] ?? { in: 2, out: 8 };
  return (tokensIn / 1_000_000) * pricing.in + (tokensOut / 1_000_000) * pricing.out;
}

export function modelMeta(model: string) {
  return (
    COST_PER_MILLION[model] ?? {
      in: 2,
      out: 8,
      label: model.split('/').pop() ?? model,
      short: model,
      color: '#71717a',
    }
  );
}
