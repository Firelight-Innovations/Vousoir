# Telemetry

**Vousoir does not collect telemetry.**

Vousoir is a fork of Code – OSS with all usage and crash telemetry removed. The application makes no outbound requests to analytics or telemetry services, and there is no instrumentation key configured in the build. The `telemetry.telemetryLevel` setting is retained for compatibility with extensions that check it, but the editor itself sends nothing regardless of its value.

## What this means

- No usage events, errors, or diagnostics are sent from the editor.
- Crash reports are not uploaded to any server.
- Third-party extensions you install may have their own telemetry. Review each extension's documentation and settings; Vousoir does not route or aggregate that data.

If you find any outbound network request from a clean Vousoir install that is not initiated by an extension or an explicit user action, please open an issue at the Vousoir repository.
