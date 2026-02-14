# EverythingTT - News Dashboard

A secure, **serverless web application** and community platform leveraging the GitHub REST API for dynamic content management.

## 🚀 Active Modules

- **News Dashboard**: A full-featured article management system with a global homepage, personal article tracking, and administrative auditing tools.
- **Mail System**: A secure, internal communication layer allowing users to create and manage `@ett.mail` addresses with multiple linked mailboxes.
- **Admin Panel**: A high-privilege management suite for user auditing, violation tracking, and security enforcement.
- **Serverless Architecture**: Built entirely as a client-side middleware that interacts directly with GitHub's infrastructure, eliminating the need for a traditional hosted backend.

## 🛡️ Security Measures

This project implements practical security layers within a serverless context:
- **Client-Side Proof-of-Work**: A cryptographically secure challenge using **SHA-256** (Web Crypto API) required for write operations to prevent automated bot attacks.
- **Behavioral Biometrics**: Lightweight heuristics that analyze mouse velocity, jitter, and interaction patterns to distinguish human users from automated scripts.
- **Dynamic CSP**: Strict Content Security Policy enforced via runtime meta-tags.
- **End-to-End Client Encryption**: Sensitive data is protected using **AES-256-GCM** encryption standards on the client before being sent to storage.

## 🛠️ Technical Architecture

- **Persistence Layer**: Uses the GitHub REST API for data storage, optimized with local caching, request queuing, and batching to handle rate limits efficiently.
- **Security Middleware**: Client-side logic in `utils.js` manages session pinning, MFA checks, encryption, and request signing.
- **Deployment**: A serverless, static web application designed for high-availability hosting (GitHub Pages) with no external server dependencies.

## 📜 Legal & AI Policy

This project distinguishes between **Authorized Development** and **Malicious Automation**:
- **Permitted**: The use of AI-assisted development tools (e.g., Trae, GitHub Copilot, Gemini) by authorized contributors to build, maintain, and audit the codebase.
- **Prohibited**: The use of automated scripts, scrapers, or adversarial AI agents to bypass security, harvest user data, or conduct denial-of-service attacks against the production environment.

Unauthorized access to private data storage is considered a cyber-security violation. 

---
*Built for the EverythingTT Community.*
