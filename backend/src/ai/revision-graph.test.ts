import { describe, expect, it } from 'vitest';
import { buildRevisionGraph } from './revision-graph';

type Draft = { text: string };

/** Checks come from a script: each check passes or fails in turn. Revisions count and rewrite the text. */
function loopWith(passes: boolean[], maxRevisions: number) {
  const seen: string[] = [];
  let checks = 0;
  const graph = buildRevisionGraph<string, Draft, string, null>(
    {
      check: async (draft) => {
        seen.push(draft.text);
        const passed = passes[checks] ?? false;
        checks += 1;
        return { findings: passed ? [] : ['problem'], critique: null, passed };
      },
      revise: async (draft, findings) => {
        const text = `${draft.text}+${findings.length}`;
        return { raw: text, draft: { text } };
      },
    },
    maxRevisions,
  );
  return { graph, seen };
}

describe('revision graph', () => {
  it('accepts a draft that passes the first check, without revising', async () => {
    const { graph, seen } = loopWith([true], 2);
    const state = await graph.invoke({ raw: 'first', draft: { text: 'first' } });
    expect(state.revisions).toBe(0);
    expect(seen).toEqual(['first']);
  });

  it('sends a failing draft back to the writer and checks the rewrite', async () => {
    const { graph, seen } = loopWith([false, true], 2);
    const state = await graph.invoke({ raw: 'first', draft: { text: 'first' } });
    expect(state.revisions).toBe(1);
    expect(seen).toEqual(['first', 'first+1']);
    expect(state.raw).toBe('first+1');
  });

  it('stops when the revision budget runs out, even if the draft still fails', async () => {
    const { graph, seen } = loopWith([false, false, false], 2);
    const state = await graph.invoke({ raw: 'first', draft: { text: 'first' } });
    expect(state.revisions).toBe(2);
    expect(seen).toHaveLength(3);
    expect(state.findings).toEqual(['problem']);
  });
});
