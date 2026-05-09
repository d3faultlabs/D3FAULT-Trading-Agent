# Security Policy

## Scope

This repository contains the D3FAULT Trading Agent — an autonomous on-chain trading engine for Solana. Security issues in scope include:

- Logic errors in the scoring model that could lead to unintended trade execution
- Vulnerabilities in the Jupiter swap integration (quote manipulation, transaction substitution)
- Issues in the persistence layer (SQL injection in the REST API routes)
- Private key exposure risks in the `WalletSigner` interface

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report privately via email: **security@d3fault.sh**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (optional)

We will acknowledge receipt within 48 hours and aim to resolve critical issues within 7 days.

## Design Guarantees

The D3FAULT Trading Agent is designed with the following security properties:

| Property | Implementation |
|---|---|
| **Non-custodial** | `WalletSigner.sendVersionedTx` signs client-side — private key never transmitted |
| **On-chain confirmation** | Every swap confirmed at `"confirmed"` commitment before state update |
| **Error propagation** | On-chain errors throw immediately — no silent fallbacks |
| **No auto-approval** | Every trade passes the full Researcher filter gate before execution |
| **Sell failure recovery** | Failed sell restores position — user can retry, no funds silently lost |
