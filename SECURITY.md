# Security Policy

## Supported versions

Only the latest published version of `locale-pref` receives security fixes.

## Reporting a vulnerability

Please report suspected vulnerabilities privately, not in a public issue.

Use GitHub's private vulnerability reporting on the repository:

1. Go to <https://github.com/axetroy/locale-pref/security/advisories/new>.
2. Describe the issue, the affected version, and a minimal reproduction.

You can expect an acknowledgement within a few days. Once a fix is available it
will be released through the normal changeset flow, and the advisory will be
published.

## Scope

`locale-pref` has no runtime dependencies and does not perform network requests.
The most relevant areas are:

- Handling of untrusted locale strings and cookie values.
- Cookie attribute construction in `cookieAdapter`.

Please include the exact input that triggers the behaviour in your report.
