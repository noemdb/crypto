import type { OpportunityInput, OpportunityOutput } from "@/lib/schemas";

// Estado mutable que fluye por el pipeline
export type EvalContext = {
  input: OpportunityInput;
  output: Partial<OpportunityOutput>;
  rejected: boolean;
  rejectionReasons: string[];
  referenceTime: number;
};

export type PipelineStep = (ctx: EvalContext) => EvalContext;

export function createContext(input: OpportunityInput): EvalContext {
  return {
    input,
    output: {},
    rejected: false,
    rejectionReasons: [],
    referenceTime: input.referenceTime ?? Date.now(),
  };
}

export function reject(ctx: EvalContext, reason: string): EvalContext {
  return {
    ...ctx,
    rejected: true,
    rejectionReasons: [...ctx.rejectionReasons, reason],
  };
}

export function applyImpact(
  ctx: EvalContext,
  field: "feesImpact" | "slippageImpact" | "networkImpact",
  value: number,
): EvalContext {
  return { ...ctx, output: { ...ctx.output, [field]: value } };
}

export function pipe(...fns: PipelineStep[]): PipelineStep {
  return (ctx: EvalContext) =>
    fns.reduce((c, fn) => (c.rejected ? c : fn(c)), ctx);
}
