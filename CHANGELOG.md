# Changelog

Every release of Remit is recorded here, newest first. The format follows
[Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This file is written for the operator deciding whether and when to upgrade. An entry says what
changed for the people who use and run an instance, not how the code changed; the commit history
answers that.

## Entry vocabulary

A release groups its entries under these headings, in this order, and leaves out the ones it does
not need:

- **Upgrade notes**: what an operator must know before upgrading. Every database migration the
  release applies when the container starts, anything that changes or removes stored data, every
  breaking change, and any action needed before or after the upgrade. A release with none of these
  says so in one line, so the absence is stated rather than implied.
- **Added**: capabilities that did not exist before.
- **Changed**: existing behaviour that now works differently.
- **Deprecated**: capabilities that still work and will be removed in a later release.
- **Removed**: capabilities that no longer exist.
- **Fixed**: defects corrected.
- **Security**: vulnerabilities fixed. Upgrade promptly when a release carries one.

Upcoming changes collect under **Unreleased** as they land. `pnpm version:patch`,
`pnpm version:minor` and `pnpm version:major` turn that section into the new version's dated
section, and refuse to run while it has no entries.

## [Unreleased]

### Upgrade notes

- No database migration and no action required.

### Added

- This changelog, kept in step with the version by the release commands.
- `/settings/system` links this changelog and the upgrade runbook beside the running version, and
  says that Remit does not check for updates.

## History before this file

Remit has not published a tagged release. Work delivered before this changelog existed is not
reconstructed here: [README.md](README.md) describes what the product does, and
[docs/delivery/](docs/delivery/README.md) records what was built and how it was verified.
