# Local braces recursion mitigation — 2026-10-09

The seven high-severity npm entries are one root advisory,
[GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
propagated through `braces`, `micromatch`, `fast-glob`, `chokidar`, `tailwindcss`,
`@next/eslint-plugin-next` and `eslint-config-next`. The affected installation has
one `braces@3.0.3` copy, reachable through build/lint tooling, not an application
request handler. Runtime-only npm audit is zero.

## Investigation and decision

The advisory lists no patched release. npm still reports 3.0.3 as latest. The
[upstream report](https://github.com/micromatch/braces/issues/70) describes recursive
AST walkers and recommends bounding nesting before those walkers. The maintainer
disputes the threat model, but the advisory remains published; we do not waive it.

The newest Next ESLint plugin (16.4.0) still depends on fast-glob. Moving just the
plugin does not remove the root dependency. Tailwind 4 would remove its branch but
not ESLint's, and changes browser support and CSS behavior. No blanket major upgrade,
package substitution, invented fixed version or advisory exclusion was used.

A small **local mitigation**, not an upstream release, applies to the exact installed
3.0.3 source through `scripts/patch-braces.mjs`:

- Parser stack depth is capped before nesting curly braces **or parentheses**.
- Compile, expand and stringify (including direct `braces/lib/*` imports) perform
  iterative AST validation before recursive work. Maximum depth is 128, maximum
  traversed nodes 20,000. Repeated/cyclic `nodes` references fail closed; legitimate
  parser `parent`/`prev` backlinks are not traversed.
- Inputs beyond these limits produce a bounded `SyntaxError` with a stable code,
  not a native call-stack overflow. Callers cannot raise the limit via options.
- SHA-256 digests pin all four upstream files. Version or byte changes stop installation
  for review. The patch is idempotent; it verifies all target sources before writing.
- `postinstall` reapplies the patch after `npm ci`. Build, lint, test, typecheck, dev
  and security scripts explicitly check the patch bytes before running, including
  when npm lifecycle hooks were skipped. Missing/changed guards fail verification.
- No dependency package name/version, registry metadata or npm audit output is altered.
  No script makes network calls or touches production data/credentials.

This addresses the reported uncontrolled AST recursion. It is **not** a general
proof against all possible expensive regex/glob expressions, expansion combinations,
malicious AST getters or attacker-controlled JavaScript objects. Tooling patterns
remain repository-owned; application inputs must never become build/glob patterns.

## Verification

Six regression groups cover ordinary glob/range/escaping behavior, deep balanced and
unbalanced patterns under the original character limit, nested parentheses, direct
AST/library entry points, cycles, affected consumer resolution, constrained-stack
subprocess behavior, patch idempotence, source tampering and unknown versions.

The clean-install and complete application verification results are recorded in
[release preparation](RELEASE_PREPARATION_2026-10-09.md). Full npm audit intentionally
continues reporting **7 high entries** because published braces 3.0.3 has no upstream
fix and audit does not inspect patched installed bytes. Report the mitigation and
this residual registry finding together; never label the full npm audit clean.

## Maintenance

When a supported upstream fix ships, review its changes, update the dependency tree,
remove this local mitigation only after equivalent exploit regressions pass, and rerun
clean install, lint/typecheck/build, browser tests and both audits. Unexpected dependency
updates deliberately require patch review. Do not bypass the checks to make a build pass.
