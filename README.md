# EverythingTT - News Dashboard

A secure, **serverless web application** and community platform leveraging the GitHub REST API for dynamic content management.

## 🚀 Features

- **Serverless Architecture**: Built entirely as a client-side middleware that interacts directly with GitHub's infrastructure, eliminating the need for a traditional hosted backend.
- **Bot Mitigation**: Lightweight heuristic checks and proof-of-work challenges to deter automated scripts and scrapers.
- **Secure Data Handling**: Leverages GitHub's repository system for storage, with client-side encryption for sensitive information.
- **Admin Panel**: Management tools for article auditing, account tracking, and security monitoring.

## 🛡️ Security Measures

This project implements practical security layers within a serverless context:
- **Client-Side Proof-of-Work**: A computational challenge required for write operations to increase the "cost" for automated bot attacks.
- **Interaction Heuristics**: Detects basic human-like interaction patterns (mouse/keyboard activity) to filter simple headless scripts.
- **Dynamic CSP**: Strict Content Security Policy enforced via runtime meta-tags.
- **End-to-End Client Encryption**: Sensitive data is protected using AES/TripleDES encryption on the client before being sent to storage.

## 📜 Legal & AI Policy

This project distinguishes between **Authorized Development** and **Malicious Automation**:
- **Permitted**: The use of AI-assisted development tools (e.g., Trae, GitHub Copilot, Gemini) by authorized contributors to build, maintain, and audit the codebase.
- **Prohibited**: The use of automated scripts, scrapers, or adversarial AI agents to bypass security, harvest user data, or conduct denial-of-service attacks against the production environment.

Unauthorized access to private data storage is considered a cyber-security violation. 

---
*Built for the EverythingTT Community.*
