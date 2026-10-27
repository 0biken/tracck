// The write → check → revise loop as a LangGraph graph. The check step verifies the draft
// and asks the critic. The conditional edge accepts the draft or sends it back to the writer.
// The revision budget is what stops a hard job from looping without end.

import { Annotation, END, START, StateGraph } from '@langchain/langgraph';

export interface CheckResult<F, C> {
  findings: F[];
  critique: C | null;
  passed: boolean;
}

export interface RevisionSteps<D, N, F, C> {
  /** Verifies the draft, and asks the critic when the budget allows a review. */
  check(draft: N): Promise<CheckResult<F, C>>;
  /** Writes the draft again, with the problems listed for the writer. */
  revise(draft: N, findings: F[], critique: C | null): Promise<{ raw: D; draft: N }>;
}

/** A state field that keeps the value a node last wrote, starting from `start`. */
const latest = <T>(start?: () => T) => Annotation<T>({ reducer: (_previous, next) => next, default: start });

/**
 * Builds the loop. `D` is the writer's raw output, `N` the numbered draft the checks read,
 * `F` a verification finding, and `C` the critic's review.
 */
export function buildRevisionGraph<D, N, F, C>(steps: RevisionSteps<D, N, F, C>, maxRevisions: number) {
  const State = Annotation.Root({
    raw: latest<D>(),
    draft: latest<N>(),
    findings: latest<F[]>(() => []),
    critique: latest<C | null>(() => null),
    passed: latest(() => false),
    revisions: latest(() => 0),
  });

  return new StateGraph(State)
    .addNode('check', async (state) => {
      const { findings, critique, passed } = await steps.check(state.draft);
      return { findings, critique, passed };
    })
    .addNode('revise', async (state) => {
      const { raw, draft } = await steps.revise(state.draft, state.findings, state.critique);
      return { raw, draft, revisions: state.revisions + 1 };
    })
    .addEdge(START, 'check')
    .addConditionalEdges('check', (state) => (state.passed || state.revisions >= maxRevisions ? END : 'revise'))
    .addEdge('revise', 'check')
    .compile();
}
