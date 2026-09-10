// covenant. the confidential engine console.
//
// the agent view and the lender view, side by side, on one screen, with no
// navigation between them. see app/engine/agent-console.tsx for why the lender
// side is an iframe of a real route rather than a second panel.

import AgentConsole from "./agent-console";

export default function EnginePage() {
  return <AgentConsole />;
}
