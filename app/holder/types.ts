// covenant. what the note holder's view is allowed to know about its own position.
//
// types only, no runtime code, no imports. the reader that fills this shape
// (`read-position.ts`) runs on the server and touches ethers and the mirror
// node; the view that renders it runs in the browser. a shared file with a
// runtime import would drag one into the other, so this file has neither.
//
// ---------------------------------------------------------------------------
// WHAT IS DELIBERATELY ABSENT
// ---------------------------------------------------------------------------
//
// nothing here carries a borrower financial figure, and nothing here carries a
// field name from `EngineInputs`. the holder's position is read from the token
// on hedera testnet; the haircut it is offered arrives separately, through the
// same narrowed disclosure the lender gets (`lib/engine/disclosure.ts`). the two
// never merge into one object, because an object that held both would be one
// careless `JSON.stringify` away from putting the filing on a page that must
// never carry it.
//
// every string below is already formatted for display. the browser does no
// scaling arithmetic on a token amount: decimals live on chain, the server reads
// them, and a rounding difference between server and client on a figure someone
// lends against is not a difference worth risking.

/** one transaction against the note, labelled by the function it called. */
export interface ChainTx {
  /** the function name, resolved from the aggregated ATS abi, never guessed */
  call: string;
  hash: string;
  hashscan: string;
  atIso: string;
  /** false when the transaction reverted. a reverted call is still history */
  ok: boolean;
}

export interface Party {
  id: string;
  evm: string;
  hashscan: string;
}

/** a live hold on the note holder's balance, read back off chain. */
export interface HoldSummary {
  holdId: number;
  /** whole notes, already scaled */
  amount: string;
  escrow: string;
  escrowLabel: string;
  /** the escrow is the configured engine account, not the agent */
  escrowIsEngine: boolean;
  destination: string;
  destinationLabel: string;
  destinationIsLender: boolean;
  /** address(0) means execute may send anywhere */
  destinationPinned: boolean;
  expiryIso: string;
  secondsToExpiry: number;
  expired: boolean;
}

export interface HolderPosition {
  readAtIso: string;
  network: string;

  token: {
    id: string;
    evm: string;
    name: string;
    symbol: string;
    hashscan: string;
    decimals: number;
    /** whole notes in issue */
    totalSupply: string;
  };

  holder: {
    id: string;
    evm: string;
    hashscan: string;
    /** kyc granted on this token. without it the notes could not have arrived */
    onRegister: boolean;
  };

  notes: {
    /** everything this account owns on partition 1 */
    held: string;
    /** the part that can still move */
    free: string;
    /** the part locked under a hold */
    underHold: string;
    /** share of the issue, one decimal, with the sign */
    sharePercent: string;
    /** the transfer that put them here. the one block B had to grant kyc for */
    arrivedBy: ChainTx | null;
    /**
     * the same figure as `free`, unformatted.
     *
     * the only two numbers this view hands the browser as numbers, because the
     * pledge sizing is interactive and has to be recomputed on every keystroke.
     * everything else is a string the server already formatted.
     */
    freeValue: number;
  };

  nominal: {
    perNote: string;
    held: string;
    /** see `notes.freeValue`. nominal per note, unformatted */
    perNoteValue: number;
  };

  rate: {
    /** what the token pays, from its own storage, e.g. "6.00%" */
    percent: string;
    /** NONE, STANDARD, FIXED or KPI_LINKED */
    typeLabel: string;
    /** the transaction that wrote it */
    postedBy: ChainTx | null;
  };

  coupon: {
    count: number;
    /** this account's entitlement on the latest coupon, in nominal */
    entitlement: string | null;
    ratePercent: string | null;
    recordDateIso: string;
    periodEndIso: string;
    recordDateReached: boolean;
    declaredBy: ChainTx | null;
  };

  maturity: {
    iso: string;
    matured: boolean;
    /** present when the date was moved after issuance */
    changedBy: ChainTx | null;
  };

  parties: {
    escrow: Party;
    lender: Party;
    agent: Party;
  };

  holds: HoldSummary[];

  /**
   * the four ways a pledge can move, each either a real transaction or null.
   *
   * null means not done, and the view says exactly that rather than drawing a
   * button that would not work. when the collateral hold is signed these fill
   * in on their own, because they are read from the note's own history and not
   * written anywhere in this application.
   */
  lifecycle: {
    pledged: ChainTx | null;
    released: ChainTx | null;
    executed: ChainTx | null;
    reclaimed: ChainTx | null;
  };

  /** every call ever made against this note, oldest first */
  history: ChainTx[];

  /** reads that did not come back. shown, never swallowed */
  warnings: string[];
}

export type PositionEnvelope =
  | { ok: true; position: HolderPosition }
  | { ok: false; error: string };
