export function validateForSave() {
  return { ok: true as const, errors: {} as Record<string, string> };
}

export function validateForGenerate(args: {
  preStageValid: boolean;
  errors?: Record<string, string>;
}) {
  return {
    ok: args.preStageValid,
    errors: args.preStageValid ? {} : (args.errors ?? {}),
  };
}

export function validateForDone(args: {
  postStageValid: boolean;
  errors?: Record<string, string>;
}) {
  return {
    ok: args.postStageValid,
    errors: args.postStageValid ? {} : (args.errors ?? {}),
  };
}
