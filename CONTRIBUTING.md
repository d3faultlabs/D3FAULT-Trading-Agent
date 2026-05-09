# Contributing to D3FAULT Trading Agent

Thank you for your interest in contributing. This document covers the process for submitting changes.

## Before You Start

- Check [open issues](https://github.com/d3faultlabs/D3FAULT-Trading-Agent/issues) to avoid duplicate work
- For major changes, open an issue first to discuss direction
- All contributions are subject to the [MIT License](./LICENSE)

## Development Setup

```bash
git clone https://github.com/d3faultlabs/D3FAULT-Trading-Agent.git
cd D3FAULT-Trading-Agent
npm install
cp .env.example .env
```

## Standards

- **TypeScript strict mode** — no `any`, no `!` non-null assertions without justification
- **No runtime dependencies** beyond what is already declared in `package.json`
- **No breaking changes** to the `AgentSettings` interface without a major version bump
- **Comments** on all non-obvious logic (scoring factors, slippage math, safety guards)

## Pull Requests

1. Fork the repo and create a branch from `main`
2. Make your changes with clear, atomic commits
3. Ensure TypeScript compiles without errors: `npx tsc --noEmit`
4. Open a PR with a clear description of what changed and why
5. Reference any related issues

## Scoring Model Changes

The 12-factor scoring model (`scoreToken` in `src/agent-engine.ts`) is the core of the agent's decision-making. Any changes to scoring weights or thresholds must include:

- A rationale for the change
- Before/after score examples on representative tokens

## Security Issues

Do **not** open a public issue for security vulnerabilities. See [SECURITY.md](./SECURITY.md).
