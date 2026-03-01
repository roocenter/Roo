import { execFile } from 'child_process';
import { promisify } from 'util';
import { NextResponse } from 'next/server';

const execFileAsync = promisify(execFile);

export const dynamic = 'force-dynamic';

type SessionRow = {
  key?: string;
  sessionKey?: string;
  session?: string;
  id?: string;
  model?: string;
  modelId?: string;
  inputTokens?: number;
  outputTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  tokensIn?: number;
  tokensOut?: number;
  totalTokens?: number | null;
};

export async function GET() {
  try {
    const { stdout } = await execFileAsync('openclaw', ['sessions', '--json', '--active', '60'], {
      windowsHide: true,
      timeout: 15_000,
      maxBuffer: 2 * 1024 * 1024,
    });

    const parsed = JSON.parse(stdout) as { sessions?: SessionRow[] };
    const sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];

    const usage = sessions
      .map((row) => {
        const tokensIn = Number(row.tokensIn ?? row.inputTokens ?? row.promptTokens ?? 0);
        const tokensOut = Number(row.tokensOut ?? row.outputTokens ?? row.completionTokens ?? 0);
        const totalTokens = Number(row.totalTokens ?? tokensIn + tokensOut);

        if (!Number.isFinite(tokensIn) || !Number.isFinite(tokensOut) || totalTokens <= 0) return null;

        return {
          sessionKey: String(row.sessionKey ?? row.session ?? row.key ?? row.id ?? 'agent:unknown:unknown'),
          model: String(row.model ?? row.modelId ?? 'gpt-5.2'),
          tokensIn,
          tokensOut,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ usage });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    return NextResponse.json({ error: message, usage: [] }, { status: 500 });
  }
}
