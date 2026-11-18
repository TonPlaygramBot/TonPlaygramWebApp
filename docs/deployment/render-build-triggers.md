# Frontend deployment triggers (review-only change)

## Evidence, 2026-11-18 13:00 UTC

The canonical `tonplaygram-bot` service has `rootDir: bot`, automatic deployments
on main commits, and builds the sibling webapp. Production reported `9dbcf8b` and
healthy MongoDB connectivity. Main was `8882f13`, two commits ahead. Those two
commits only changed webapp, root test and docs paths, so neither touched bot.
Render's service response did not expose a buildFilter. No commit_ignored event
was returned; path exclusion is a strongly supported diagnosis, not a logged
webhook rejection. No settings or deployment were changed during diagnosis.

## Minimal change

Keep rootDir, commands, service identity, disk, health check and all environment
settings unchanged. Add repo-relative included paths for bot, webapp and shared
build/runtime inputs. `bot/**` explicitly preserves every prior backend trigger.
Root documentation/tests are excluded by the allowlist. No CI deploy hook, dummy
backend touch, second service, automatic preview or scheduled rebuild is added.
The list is not a dependency-graph engine: review it when new runtime roots are
introduced. Tests model matching for the simple globs, not Render's webhook engine.

Official references checked on 2026-11-18:
- https://render.com/docs/monorepo-support (build filters may include sibling paths;
  paths are repo-relative even with a rootDir)
- https://render.com/docs/blueprint-spec (buildFilter replaces existing filters)
- https://render.com/schema/render.yaml.json (structural validation)

## Controlled rollout, not blind deployment

Keep this PR draft until the actual Blueprint association/automatic-sync setting
and dashboard filter diff are reviewed. A merged YAML change alone does not prove
an unmanaged service adopted it. If managed, sync can replace existing filters
and trigger a deployment: merging is operational, not merely documentation.
Do not manually deploy and sync concurrently. Batch approved frontend changes
into one release, then observe whether exactly one build/deploy starts before
considering any further action. Do not test triggers with dummy commits.

This single-instance service has a persistent disk. A prior rollout exhibited
about seven minutes of observed 502 responses; that is an observation, not an
expected duration or guaranteed bound. Plan for interruption and avoid matches or
payment activity during cutover. Preserve the current healthy deployment until
a reviewed release is intended. Do not alter disk, replicas, health or runtime
commands to address this trigger issue.

After authorized rollout verify `/api/version` equals the intended main commit,
`/api/health` reports DB connected, and actual Games/Chess UI reflects the release.
No successful build, device/WebGL test or live trigger validation is implied by
local config tests. If rollback is needed, retain the last healthy commit and
use a separately reviewed rollout; reverting filters may itself deploy again.
