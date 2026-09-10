// covenant. the error type both engine callers share.
//
// its own module so that the lender's bundle can have error handling without
// also pulling in the agent's client, which knows the shape of the borrower's
// financials and the path that accepts them. see lib/engine/disclosure-client.ts.

export class EngineCallError extends Error {
  readonly problems: string[];
  constructor(message: string, problems: string[] = []) {
    super(message);
    this.name = "EngineCallError";
    this.problems = problems;
  }
}

export async function readError(res: Response): Promise<EngineCallError> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // fall through to the status line
  }
  if (body && typeof body === "object" && "error" in body) {
    const b = body as { error?: string; problems?: string[] };
    return new EngineCallError(
      b.error ?? `engine call failed, ${res.status}`,
      b.problems ?? [],
    );
  }
  return new EngineCallError(`engine call failed, ${res.status}`);
}
