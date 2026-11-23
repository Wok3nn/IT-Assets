# Adoption configuration mismatch investigation

## Static finding and reproduction

There is a reproducible representation mismatch between legacy inspection and managed
capture. This is a verifier expectation inconsistency, not evidence of inventory loss.
The operator diagnostic confirmed these absent-versus-materialized fields in the rehearsal.
The codes do not disclose the actual title, timeout or credential contents; the corrected
verifier must still check their exact values before accepting them.

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
the four raw differences, and checks the comparison-only correction. No database
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

## Confirmed title/session source mapping and correction

Legacy inspection selects only existing `Setting` rows; it does not materialize runtime
fallbacks. Both `settings.service.ts` and `installation-presentation.ts` supply
`IT-Asset-Tracker` and 15 minutes when those rows are absent. Consequently the wizard
can display/import that effective presentation without either key in the captured payload.
`ControlStore.savePresentation` writes both keys explicitly; enabling appearance alone
preserves the candidate. The diagnostic proves source absence, but does not establish
which past UI save materialized the actual keys.

For disabled Entra, `prepareLegacyAuthentication` supplies empty optional strings, adoption
saves that authentication object, and `prepareManagedConfiguration` overlays it onto the
captured settings. An empty `secretReference` property is a representation state, not a
created credential. The credential diagnostic alone cannot distinguish an empty from a
nonempty actual reference; only exact empty strings qualify for this correction.

This is a verifier bug comparing sparse storage with materialized effective defaults,
not evidence of lost configuration. The acceptance verifier now projects expected values
in memory only, after validating both original payloads:

- Missing legacy title/timeout may match only the exact strings `IT-Asset-Tracker` / `15`.
- Missing optional Entra tenant/client/redirect/reference may match only an empty string,
  only with source Entra and SSO explicitly disabled and installation Entra runtime off.
- Explicit source values are never replaced. Deleting source fields, changing nonempty
  values/references/secrets, trimming, numeric reformatting, nulls, enabled Entra and
  unknown authentication state do not receive this exception.

No application runtime, database rows, encrypted review, control configuration, canonical
serializer or evidence fingerprints change. The existing full comparison, category checks
and organization/appearance title check still run. Other mismatches remain failures.
Regression coverage reproduces all six reported fields, verifies input immutability,
rejects changed values and credentials, and guards disabled/unknown/enabled Entra cases.
The live rehearsal must be rerun to establish that its values meet these narrow rules.

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
Local validation: 91 tests passed (one POSIX-only skip), typecheck, lint, managed build,
JavaScript syntax and diff checks passed. Docker is unavailable locally; no live rehearsal,
existing inventory or acceptance control volume accessed.
