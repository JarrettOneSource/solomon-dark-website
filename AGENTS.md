# Website validation

Run `./scripts/validate.sh` from the repository root for the complete Website
gate. Run `./scripts/validate.sh lint` when only lint is required.

These are the repository's only supported validation entrypoints. Do not
bypass them with component-specific tooling; the validation contract rejects
alternate lint entrypoints.
