#!/usr/bin/env bash
set -Eeuo pipefail
umask 027

readonly INCOMING="/var/tmp/vitrina-deploy/release.tar.gz"
readonly APP_ROOT="/var/www/vitrina"
readonly BACKEND_DIR="${APP_ROOT}/backend"
readonly FRONTEND_DIST="${APP_ROOT}/frontend/dist"
readonly RELEASES_DIR="${APP_ROOT}/releases"
readonly STAGING_ROOT="/var/tmp/vitrina-deploy/staging"
readonly SERVICE="vitrina"
readonly HEALTH_URL="http://127.0.0.1:5100/health/ready"

log() {
	printf '[vitrina-deploy] %s\n' "$*"
}

fail() {
	log "ERROR: $*"
	exit 1
}

[[ $EUID -eq 0 ]] || fail "This script must run as root."
[[ -s "$INCOMING" ]] || fail "Release archive not found: $INCOMING"

exec 9>/run/lock/vitrina-deploy.lock
flock -n 9 || fail "Another deployment is already running."

command -v tar >/dev/null
command -v curl >/dev/null
command -v systemctl >/dev/null
command -v flock >/dev/null
[[ -x /usr/local/sbin/vitrina-backup-postgresql ]] || fail "PostgreSQL backup script is missing."

# Validate the archive before extracting it.
tar -tzf "$INCOMING" >/dev/null || fail "Release archive is invalid."
if tar -tzf "$INCOMING" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
	fail "Unsafe path detected in release archive."
fi

RELEASE_SHA="$(tar -xOzf "$INCOMING" release.sha 2>/dev/null | tr -d '\r\n')"
[[ "$RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]] || fail "Invalid or missing release.sha."

readonly RELEASE_ID="$(date -u +%Y%m%dT%H%M%SZ)-${RELEASE_SHA:0:12}"
readonly RELEASE_DIR="${RELEASES_DIR}/${RELEASE_ID}"
readonly NEW_BACKEND="${APP_ROOT}/backend.new"
readonly NEW_FRONTEND="${APP_ROOT}/frontend/dist.new"
readonly OLD_BACKEND="${RELEASE_DIR}/backend"
readonly OLD_FRONTEND="${RELEASE_DIR}/frontend-dist"

BACKEND_MOVED=0
FRONTEND_MOVED=0
BACKEND_INSTALLED=0
FRONTEND_INSTALLED=0
DEPLOYMENT_MUTATION_STARTED=0

rollback_on_exit() {
	local rc=$?
	trap - EXIT

	if [[ "$rc" -ne 0 && "$DEPLOYMENT_MUTATION_STARTED" -eq 1 ]]; then
		log "Deployment failed; attempting application-file rollback."
		systemctl stop "$SERVICE" >/dev/null 2>&1 || true

		if [[ "$FRONTEND_INSTALLED" -eq 1 ]]; then
			rm -rf "$FRONTEND_DIST"
		fi
		if [[ "$FRONTEND_MOVED" -eq 1 && -d "$OLD_FRONTEND" ]]; then
			mkdir -p "$(dirname "$FRONTEND_DIST")"
			mv "$OLD_FRONTEND" "$FRONTEND_DIST"
		fi

		if [[ "$BACKEND_INSTALLED" -eq 1 ]]; then
			rm -rf "$BACKEND_DIR"
		fi
		if [[ "$BACKEND_MOVED" -eq 1 && -d "$OLD_BACKEND" ]]; then
			mv "$OLD_BACKEND" "$BACKEND_DIR"
		fi

		systemctl start "$SERVICE" >/dev/null 2>&1 || true
		log "Previous application files restored where possible. Database was not automatically restored."
	fi

	exit "$rc"
}
trap rollback_on_exit EXIT

mkdir -p "$RELEASES_DIR" "$STAGING_ROOT" "$APP_ROOT"
rm -rf "$STAGING_ROOT/current" "$NEW_BACKEND" "$NEW_FRONTEND"
mkdir -p "$STAGING_ROOT/current" "$RELEASE_DIR"

tar -xzf "$INCOMING" -C "$STAGING_ROOT/current" --no-same-owner

[[ -f "$STAGING_ROOT/current/backend/Vitrina.Api.dll" ]] || fail "Backend publish output is incomplete."
[[ -f "$STAGING_ROOT/current/frontend/dist/index.html" ]] || fail "Frontend build output is incomplete."

# Back up PostgreSQL before the new application can execute EF Core migrations.
log "Creating PostgreSQL backup."
/usr/local/sbin/vitrina-backup-postgresql

DEPLOYMENT_MUTATION_STARTED=1
log "Stopping ${SERVICE}."
systemctl stop "$SERVICE"

if [[ -d "$BACKEND_DIR" ]]; then
	mv "$BACKEND_DIR" "$OLD_BACKEND"
	BACKEND_MOVED=1
fi
if [[ -d "$FRONTEND_DIST" ]]; then
	mv "$FRONTEND_DIST" "$OLD_FRONTEND"
	FRONTEND_MOVED=1
fi

cp -a "$STAGING_ROOT/current/backend" "$NEW_BACKEND"
chown -R vitrinasvc:vitrinasvc "$NEW_BACKEND"
find "$NEW_BACKEND" -type d -exec chmod 750 {} +
find "$NEW_BACKEND" -type f -exec chmod 640 {} +
mv "$NEW_BACKEND" "$BACKEND_DIR"
BACKEND_INSTALLED=1

mkdir -p "$(dirname "$FRONTEND_DIST")"
cp -a "$STAGING_ROOT/current/frontend/dist" "$NEW_FRONTEND"
chown -R deploy:vitrinasvc "$NEW_FRONTEND"
find "$NEW_FRONTEND" -type d -exec chmod 755 {} +
find "$NEW_FRONTEND" -type f -exec chmod 644 {} +
mv "$NEW_FRONTEND" "$FRONTEND_DIST"
FRONTEND_INSTALLED=1

log "Starting ${SERVICE}; EF Core migrations run during application startup."
systemctl start "$SERVICE"

healthy=0
for attempt in $(seq 1 60); do
	if curl --fail --silent --show-error "$HEALTH_URL" >/dev/null 2>&1; then
		healthy=1
		break
	fi
	sleep 2
done

if [[ "$healthy" -ne 1 ]]; then
	fail "Readiness check did not pass: $HEALTH_URL"
fi

systemctl is-active --quiet "$SERVICE" || fail "Systemd service is not active."

rm -rf "$STAGING_ROOT/current"
rm -f "$INCOMING"
log "Deployment ${RELEASE_ID} completed successfully."
log "Previous application files, if any, are retained in ${RELEASE_DIR}."
