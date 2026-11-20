# Adoption configuration mismatch investigation

## Static finding and reproduction

There is a reproducible representation mismatch between legacy inspection and managed
capture. This is a verifier expectation inconsistency, not evidence of inventory loss.
It is a candidate explanation for the reported rehearsal; its exact fields still require
the opt-in diagnostic run against that environment.

`prepareInstallationConfiguration` in `legacy-adoption.ts` includes only setting keys
actually present in the legacy Setting table. `prepareLegacyAuthentication` supplies empty
defaults for absent optional Entra fields. Adoption saves that authentication object.
`prepareManagedConfiguration` then overlays all four fields from that object whenever it
is present, including empty defaults:

- `settings.authentication.entra.tenantId`
- `settings.authentication.entra.clientId`
- `settings.authentication.entra.redirectUri`
- `settings.authentication.entra.secretReference`

Thus an Entra-disabled legacy source with these fields absent produces a captured/imported
configuration with four additional empty fields. The canonicalizer sorts keys but does not
equate absent with empty. The verifier re-inspects the legacy source, so its expected
configuration lacks those fields and the strict equality check fails.

The regression uses the real legacy/authentication/managed preparation functions, proves
the four differences, and proves the unchanged verifier still rejects them. No database
or control volume is needed for the reproduction. If the legacy rows already contain all
four empty fields, this particular mismatch does not occur.

## Other paths audited

- Capture intentionally gives saved profile authentication precedence over source settings.
  Nonempty differences there may be intentional overrides, but strict legacy equality must
  continue to flag them for review.
- Review application writes the captured candidate; it only normalizes enabled Entra/mail
  credentials and validates an enabled timezone. It updates the organization title without
  changing the captured settings to match a later database read.
- Appearance enablement writes the same candidate; defaults/trimming in presentationValues
  are projections. Saving appearance can materialize title/session defaults and normalize
  their representations, unlike simply enabling appearance.
- Mail enablement preserves source fields and adds decrypted credential material if needed;
  the verifier applies the same credential normalizer. Saving mail can add empty optional
  fields and trim tenant/client/sender inputs.
- Entra enablement removes the environment reference after freezing its credential; the
  verifier applies this same normalizer when enabled. Saved/captured profile authentication
  may already have normalized whitespace or missing optional fields before that point.
- Timezone capture reads the deployment environment; enabling a null timezone uses the
  current deployment default. A later environment change, explicit timezone edit, branding
  change, source metadata difference or original-key provenance difference can also fail
  strict canonical equality.
- Runtime enablement markers and organization-title comparison are **outside** the canonical
  configuration. They cannot directly cause CONFIGURATION_MISMATCH; their separate guards
  run only after equality succeeds. Runtime state does select credential normalization.

## Proposed minimal fix — not implemented

If diagnostics confirm only absent-versus-empty optional Entra defaults, agree on one
explicit shared comparison normalization for those four fields in the Entra-disabled case,
used on both expected and actual configurations. Retain strict checks for nonempty values,
credentials, enabled Entra, source metadata and all other settings. Add tests that changed
nonempty values still fail. Do not broadly ignore Entra settings or rewrite stored reviews.
This would correct a verifier representation assumption; it needs separate approval before
implementation. If diagnostics instead show unequal nonempty values or credential state,
investigate that specific discrepancy before deciding whether any fix is justified.

This change adds diagnostics only. No comparison is normalized, bypassed or relaxed; no
settings are reconciled. Existing canonical fingerprints, storage and successful acceptance
behavior remain unchanged.

## Diagnostic vocabulary

On a canonical mismatch, the existing stage/reason line is followed by a bounded set of
DIAGNOSTIC_DETAIL lines. Categories are top-level configuration categories. Field paths
come only from a fixed allowlist; names from input objects, branding filenames, values,
hashes and URLs are never emitted. Expected means the normalized re-inspected legacy
configuration; actual means the stored installation configuration.

- MISSING_EXPECTED / MISSING_ACTUAL identify which side lacks the property.
- MISSING_EXPECTED_EMPTY_ACTUAL / EMPTY_EXPECTED_MISSING_ACTUAL identify missing versus
  empty-string representation specifically.
- NULL_VS_EMPTY and EMPTY_VS_VALUE describe presence representations, without values.
  Current canonical validation rejects null setting values before this stage; the classifier
  can still safely handle them in tests or future schemas.
- TRIM_NORMALIZATION_ONLY and NUMBER_NORMALIZATION_ONLY report equality under known field
  trim/numeric rules. They do not prove which operation caused the difference and do not
  normalize the actual acceptance comparison.
- UNEQUAL_VALUES indicates another difference; branding remains one aggregate field.
- Credential fields and key provenance use fixed aliases and only
  CREDENTIAL_MISSING_EXPECTED, CREDENTIAL_MISSING_ACTUAL, CREDENTIAL_EMPTY_VS_CONFIGURED or
  CREDENTIAL_STATE_DIFFERENT. No credential contents, reference names or hashes appear.
- Unknown differences and diagnostic analysis errors produce only fixed
  UNCLASSIFIED_DIFFERENCE or DETAILS_UNAVAILABLE codes; the original mismatch still fails.

See [the operator command](docker-upgrade-acceptance.md#diagnose-an-adoption-verification-failure-safely).
Local validation: synthetic mismatch tests and real preparation-function reproduction;
no live Docker rehearsal, existing inventory or acceptance control volume accessed.
