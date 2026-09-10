// covenant. where the issued note lives.
//
// block A issued the note and EVIDENCE.md G1 verified it. every block after A
// operates on that token, so the address has to come from somewhere. it comes
// from the environment, never from a literal in a source file.
//
// this is deliberately not in lib/config.ts. that file is shared with the
// engine and lender views and is edited by another agent concurrently; a token
// reference only the chain code needs does not belong in the shared reader.
//
// next inlines process.env.NEXT_PUBLIC_* only when the property is referenced
// literally, so both reads below are written out in full. see DECISIONS.md D8.

export interface NoteTokenRef {
  /** hedera id form, `0.0.x`. what the SDK request objects take. */
  id: string;
  /** evm address form. what a direct ethers call against the diamond takes. */
  evm: string;
}

/**
 * returns the configured note, or null when the environment does not carry one
 * yet. null rather than a throw, because the console has to render a useful
 * message in that case rather than a blank error page.
 */
export function readNoteTokenRef(): NoteTokenRef | null {
  const id = process.env.NEXT_PUBLIC_NOTE_TOKEN_ID?.trim();
  const evm = process.env.NEXT_PUBLIC_NOTE_TOKEN_EVM?.trim();
  if (!id || !evm) return null;
  return { id, evm };
}
