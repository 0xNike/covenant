# architecture. where the confidential boundary sits

this diagram exists to answer one question: what enters the enclave, what leaves it, and who
can see each. everything else in the diagram is context for that question.

it also draws a line the submission depends on being honest about: nothing here implies
on-chain verification of the enclave. there is none. a human reads the enclave's output and
signs a transaction. that gap is drawn on purpose, not hidden.

---

## the diagram

```mermaid
flowchart TB
    classDef enclave fill:#eaf7ea,stroke:#2f7a2f,stroke-width:2px,color:#1a4d1a;
    classDef relay fill:#fff6e0,stroke:#b8860b,stroke-width:2px,color:#5c4400;
    classDef chain fill:#e8f0fe,stroke:#3b5bdb,stroke-width:2px,color:#1a2d6b;
    classDef hidden fill:#f2f2f2,stroke:#888888,stroke-width:1px,stroke-dasharray: 3 3,color:#555555;
    classDef party fill:#ffffff,stroke:#333333,stroke-width:1px;

    %% ---- stage 1: issuance ----
    subgraph S1["1. issuance"]
        direction LR
        AG1["issuer / agent<br/>0.0.10424387"]:::party
        TX1["Bond.createKpiLinkedRate<br/>bond config 4, resolver 0.0.9212226,<br/>factory 0.0.9213391"]:::chain
        AG1 -->|signs, MetaMask| TX1
    end

    %% ---- stage 2: kyc gate ----
    subgraph S2["2. kyc gate"]
        direction LR
        AG2["issuer / agent"]:::party
        NH2["note holder<br/>0.0.10444395"]:::party
        BLOCK2["transfer to note holder<br/>rejected, no kyc grant on record"]:::chain
        GRANT2["grantKycMock"]:::chain
        OK2["same transfer<br/>now succeeds"]:::chain
        AG2 --> BLOCK2
        AG2 -->|signs| GRANT2 --> OK2
        NH2 --> OK2
    end

    S1 --> S2

    %% ---- stage 3: coupon ----
    subgraph S3["3. coupon"]
        direction LR
        AG3["issuer / agent"]:::party
        TERMS3["setCoupon<br/>rate and dates, on-chain"]:::chain
        LIST3["getCouponHolders<br/>holder list, read from chain"]:::chain
        PAY3["payment to holders<br/>off-chain, not an ATS transaction"]:::hidden
        AG3 -->|signs| TERMS3 --> LIST3 --> PAY3
    end

    S2 --> S3

    %% ---- stage 4: confidential compute, the boundary ----
    subgraph S4["4. confidential compute, the boundary"]
        direction TB
        FIN4["borrower's private financials<br/>revenue, EBITDA, leverage"]:::hidden
        ENCLAVE4["confidential compute engine<br/>hardware-isolated enclave<br/>local service today, CRE handlerInTee is the target"]:::enclave
        OUT4["covenant verdict, pass or fail<br/>kpi value<br/>haircut"]:::enclave
        FIN4 -->|enters, never leaves| ENCLAVE4
        ENCLAVE4 -->|only these three values leave| OUT4
    end

    S3 --> S4

    %% ---- stage 5: reprice ----
    subgraph S5["5. reprice"]
        direction LR
        AG5["issuer / agent<br/>reads the kpi value on screen"]:::party
        KPI5["addKpiData"]:::chain
        RATE5["KpiLinkedRateLib<br/>rate steps at the next coupon's fixingDate"]:::chain
        AG5 -->|signs, MetaMask| KPI5 --> RATE5
    end

    OUT4 -.->|kpi value, human reads it and types it in, no on-chain link| AG5
    S4 --> S5

    %% ---- stage 6: collateralize ----
    subgraph S6["6. collateralize"]
        direction LR
        NH6["note holder"]:::party
        HOLD6["createHoldByPartition<br/>escrow = 0.0.10445014, target = lender"]:::chain
        LEN6["lender<br/>0.0.10444404<br/>advances cash at the haircut, off-chain"]:::party
        NH6 -->|signs| HOLD6 --> LEN6
    end

    OUT4 -.->|haircut only, human reads it and sets the advance rate, no on-chain link| LEN6
    S5 --> S6

    %% ---- stage 7: resolve ----
    subgraph S7["7. resolve"]
        direction LR
        ESC7["escrow account operator<br/>signs as 0.0.10445014, MetaMask"]:::relay
        ENFORCE7["HoldStorageWrapper.sol<br/>checks msg.sender == hold.escrow<br/>reverts IsNotEscrow otherwise"]:::chain
        REL7["releaseHoldByPartition<br/>repayment path"]:::chain
        EXE7["executeHoldByPartition<br/>default path"]:::chain
        LEN7["lender receives the collateral"]:::party
        ESC7 -->|signs one of the two| ENFORCE7
        ENFORCE7 -->|passes| REL7
        ENFORCE7 -->|passes| EXE7
        EXE7 --> LEN7
    end

    S6 --> S7
```

**legend.** green: inside the enclave. grey with a dashed border: private, off-chain, or
carried by a human with no cryptographic link to what precedes it. blue: an on-chain
transaction against the ATS diamond on Hedera testnet, through the resolver `0.0.9212226`.
amber: a human operating a designated Hedera account, not the engine acting on its own.

---

## the confidential boundary, in plain terms

the borrower's revenue, EBITDA and leverage go into the confidential compute engine and stop
there. nothing crosses back out except three values: a covenant verdict, a kpi value, and a
haircut. the lender only ever sees the haircut. the issuer/agent sees the kpi value, because
it has to be typed into `addKpiData`, but not the financials behind it.

today the engine runs as a plain local service behind a clean interface. the target for the
Chainlink confidential workflow leg is to run the same computation behind a CRE
`handlerInTee`, inside a hardware-isolated enclave, with CRE CLI simulation as the fallback
evidence if the live path does not land in time. **this diagram is true either way.** the
boundary it draws is the same whether the enclave is a genuine TEE-based CRE workflow or a
CRE CLI simulation of one, because in both cases the enclave's output leaves the same way: a
human reads it, then signs.

that last step is the honest part of this diagram. the dashed arrows out of stage 4 are not
transactions. they are a person reading a number off a screen. nothing on Hedera checks that
the number the issuer/agent typed into `addKpiData`, or the haircut the lender priced against,
is the number the enclave actually produced. there is no attestation on chain, and no arrow in
this diagram claims there is.

the escrow separation in stage 7 is contract-enforced, which is different in kind from the
relay above it. `HoldStorageWrapper.sol` checks the caller against `hold.escrow` and reverts
`IsNotEscrow` for anyone else. the engine's account, `0.0.10445014`, is a distinct Hedera
account from the issuer/agent's, set once at hold creation and immutable for that hold. that
separation is what stops the issuer/agent from being the one who decides release versus
execute, which is the arrangement this project replaces. it is enforced by the contract, not
by a convention we could quietly break on stage.

## what this diagram deliberately does not draw

- **no arrow from the enclave into the token.** none exists. the engine's output reaches the
  chain only through a person typing a value into a transaction and signing it in MetaMask.
- **no on-chain attestation of the enclave's execution.** nothing on Hedera verifies that the
  published computation is what ran, or that the number a human typed in matches its output.
- **no hash commitment of the engine's output in `Hold.data`.** putting a hash of the engine's
  output into `Hold.data` at `createHoldByPartition` would give an on-chain commitment to the
  exact computation, and is under consideration. it is not built and not decided, so it is not
  drawn. if it ships, it earns its own arrow.
- **no cash leg for the lender's advance.** the lender pricing and advancing cash at the
  haircut happens off-chain, tracked in the console. the collateral hold moves the note; it
  does not move cash.
- **no push payment for the coupon.** `setCoupon` records terms on-chain and the holder list
  is read from the chain. paying holders is off-chain, not an ATS transaction.

## why this matters more than it looks

the enclave replaces trust in execution with attestation. it does not touch trust in the
inputs, since the borrower still supplies the revenue and EBITDA figures the engine reads,
and a borrower's incentive to inflate them is larger and more direct than an agent bank's
incentive to shade a haircut. see `PROJECT_BRIEF.md` §4 for the full argument. this diagram is
the visual half of that same claim: it shows exactly where the attestation ends and the human
relay begins, so a reader does not have to take our word for where the line is.
