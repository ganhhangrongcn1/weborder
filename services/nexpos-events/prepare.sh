#!/bin/sh
# Prepare files only. Never enroll, start, or enable the observer here.
set -eu
revision=${1:?Pass the reviewed 40-character Git commit}
case "$revision" in *[!a-f0-9]*|'') exit 2 ;; esac
[ "${#revision}" -eq 40 ] || exit 2
[ "$(id -u)" -eq 0 ] || exit 2
target=/opt/ghr-nexpos-observer
[ ! -e "$target" ] || { echo 'Refusing to overwrite existing observer'; exit 2; }
test -x /opt/ghr-node/bin/node
install -d -m 755 "$target"
for file in services/nexpos-events/observer.mjs services/nexpos-events/signalDelivery.mjs services/nexpos-events/ghr-nexpos-observer.service supabase/functions/nexpos-event-observer/policy.mjs supabase/functions/nexpos-event-observer/signals.mjs; do
  install -d -m 755 "$target/$(dirname "$file")"
  curl --fail --silent --show-error --connect-timeout 10 --max-time 30 \
    "https://raw.githubusercontent.com/ganhhangrongcn1/weborder/$revision/$file" \
    -o "$target/$file"
done
/opt/ghr-node/bin/node --check "$target/services/nexpos-events/observer.mjs"
id ghr-observer >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin ghr-observer
install -d -m 750 -o root -g ghr-observer /etc/ghr-nexpos-observer
install -m 644 "$target/services/nexpos-events/ghr-nexpos-observer.service" /etc/systemd/system/ghr-nexpos-observer.service
systemctl daemon-reload
systemd-analyze verify /etc/systemd/system/ghr-nexpos-observer.service
printf '%s\n' "$revision" > "$target/REVISION"
echo 'Prepared only: no worker credential, no enrollment, service not started.'
