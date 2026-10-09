# Confirmed Production Reference

The inventory in confirmed.json identifies the complete 285-file source package
for deployment 69cd55b9-1ca2-495d-a47d-fef194f11f45, approved by the owner after rollback.
This is source-package evidence, not a certification of full infrastructure recovery.

Build only from committed Git blobs using scripts/confirmed-release.cjs. It stops
on dirty worktrees, missing files or any hash mismatch. Update the inventory only
after reviewing and testing intentional changes. Never deploy the repository root:
it contains tools, dependencies and files outside the approved release inventory.

GitHub production auto-deploy must remain disabled. Preview deployment settings
were not changed. Production replacement requires a separate reviewed operation.

Backup source selection must use the active deployment ID and verified package
inventory, not only its commit_hash: older manual releases carry stale commit IDs.
The existing backup-deployed-package.cjs / backup-production-source.cjs implement
that selection. Preserve immutable published packages and their *-record.json files.
If the active package cannot be verified, stop rather than substituting an old commit.

External configuration to preserve separately:
- Cloudflare redirect rule fccdcd6f78894b9c83921cf2ddf5fc1c in zone
  98fc608512dd483876952dfd8216e154 redirects apex website GET/HEAD pages to www.
  Preserve path and query; /api and /api/* are excluded. POST and chat are unchanged.
- Cloudflare secrets, D1/KV data, the separate chat Worker and third-party storage
  require their existing encrypted backup/recovery workflow; this Git snapshot is not
  a replacement for those exports.
- Never copy decrypted recovery output to removable storage.
