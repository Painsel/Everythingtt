# EverythingTT - News Dashboard

A secure, decentralized news dashboard and community platform powered by GitHub API.

## 🚀 Features

- **Robust Security**: Multi-layered protection including IP pinning, session validation, and role-based access control.
- **Bot Mitigation**: Lightweight heuristic checks and proof-of-work challenges to deter automated scripts and scrapers.
- **GitHub-Backed Storage**: Leverages GitHub's infrastructure for secure, encrypted data management.
- **Admin Panel**: Management tools for article auditing, account tracking, and security monitoring.

## 🛡️ Security Measures

This project implements practical security layers:
- **Client-Side Proof-of-Work**: A computational challenge required for write operations to increase the "cost" for automated bot attacks.
- **Interaction Heuristics**: Detects basic human-like interaction patterns (mouse/keyboard activity) to filter simple headless scripts.
- **Dynamic CSP**: Strict Content Security Policy enforced via runtime meta-tags.
- **Encrypted Data**: Sensitive information is protected using client-side encryption before storage.

## 📜 Legal & AI Policy

This project distinguishes between **Authorized Development** and **Malicious Automation**:
- **Permitted**: The use of AI-assisted development tools (e.g., Trae, GitHub Copilot, Gemini) by authorized contributors to build, maintain, and audit the codebase.
- **Prohibited**: The use of automated scripts, scrapers, or adversarial AI agents to bypass security, scrape user data, or conduct denial-of-service attacks against the production environment.

Unauthorized access to private data storage is considered a cyber-security violation. 

---
*Built for the EverythingTT Community.*
