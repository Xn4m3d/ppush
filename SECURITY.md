# Security Policy

ppush is a zero-knowledge secret-sharing service: the encryption key never
reaches the server (it lives in the URL fragment), so the server stores only
ciphertext. See the [README](README.md) for the full threat model.

## Reporting a vulnerability

Please report security issues privately to **contact@ppush.online**. Do not open
a public issue for security-sensitive reports.

Where possible, include:

- a description of the issue and its impact,
- steps to reproduce or a proof of concept,
- the affected version (shown in the site footer).

We aim to acknowledge reports within a few days and will keep you informed of
remediation progress. Responsible disclosure is appreciated — please give us
reasonable time to fix an issue before any public disclosure.

## Scope

The hosted service at <https://ppush.online> and the code in this repository.
