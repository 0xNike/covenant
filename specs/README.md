# specs

all spec files, prompts and planning artifacts for the covenant build.

**this directory being committed is an ETHGlobal eligibility condition, not housekeeping.**
AI tools may assist but not author the whole project, and spec files and prompts must be in
the repo. rudolph checks periodically that nothing here is untracked or gitignored.

git does not track empty directories, which is why this file exists.

| file | what | owner |
|---|---|---|
| `00-mission.md` | the shared brief every agent reads first. **written** | hermes |
| ~~`01-agent-charters.md`~~ | **cut, see DECISIONS.md D7.** the charters are `.claude/agents/*.md`, which are committed and are what the runtime loads | |
| `02-sdk-surface.md` | ATS sdk operation surface, cited to file and line | athena |
| `03-upstream-workflows.md` | the ATS maintainers' own `.claude` workflows | athena |

the agent definitions themselves live in `.claude/agents/`, one file per agent. each one
opens by telling the agent to read `00-mission.md` here first, so the shared context lives in
exactly one place.

**note on loading:** claude code reads `.claude/agents/` at session start. definitions added
mid-session do not resolve until the session restarts.
