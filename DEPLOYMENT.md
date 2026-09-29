# Production release

The working production baseline is deployment 79900432-78f3-4552-ae39-b310cbe62fb6.
Its final chat launcher changes are included in this repository.

Use `powershell -File scripts/deploy-production.ps1` from this checkout.
The script requires a clean main branch matching origin/main and a passing chat entry test.
Commit and push changes before deployment. Do not deploy backup folders or use --commit-dirty=true.

Production domains: https://www.takdaro.com and https://takdaro.com.
Cloudflare Pages project: takdaro-site. Production branch: main.
Historical deployment URLs are immutable previews, not the production entry point.
Do not roll production back without reviewing all intervening feature changes.

The separate chat.takdaro.com Worker is maintained in the chatonline project;
it is not deployed by this repository. Production D1 data and secrets are also
separate from Git and must not be overwritten with local fixtures.
