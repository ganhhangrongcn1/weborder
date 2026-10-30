#!/usr/bin/env bash
set -Eeuo pipefail
revision="${1:?Supply the reviewed Git commit SHA}"
[[ "$revision" =~ ^[a-f0-9]{40}$ ]] || exit 2
[[ "$(id -u)" == 0 ]] || exit 3
root=/opt/ghr-nexpos-observer
[[ -f "$root/services/nexpos-events/observer.mjs" ]] || exit 4
stage=$(mktemp -d "$root/reviewed.XXXXXX")
chmod 700 "$stage"
base="https://raw.githubusercontent.com/ganhhangrongcn1/weborder/$revision"
files=(services/nexpos-events/observer.mjs services/nexpos-events/signalDelivery.mjs supabase/functions/nexpos-event-observer/policy.mjs supabase/functions/nexpos-event-observer/signals.mjs)
curl -fsSL --max-time 30 "$base/services/nexpos-events/worker-files.sha256" -o "$stage/worker-files.sha256"
for file in "${files[@]}"; do
  mkdir -p "$stage/$(dirname "$file")"
  curl -fsSL --max-time 30 "$base/$file" -o "$stage/$file"
  /opt/ghr-node/bin/node --check "$stage/$file"
done
(cd "$stage" && sha256sum -c worker-files.sha256)
for file in "${files[@]}"; do
  if [[ -f "$root/$file" ]]; then
    mkdir -p "$stage/previous/$(dirname "$file")"
    cp -a "$root/$file" "$stage/previous/$file"
  fi
done
rollback() {
  trap - ERR
  for file in "${files[@]}"; do
    if [[ -f "$stage/previous/$file" ]]; then install -D -m 644 "$stage/previous/$file" "$root/$file"; fi
  done
  systemctl restart ghr-nexpos-observer || true
  echo 'Worker update failed; previous source restored.' >&2
  exit 1
}
trap rollback ERR
for file in "${files[@]}"; do install -D -m 644 "$stage/$file" "$root/$file"; done
systemctl restart ghr-nexpos-observer
systemctl is-active --quiet ghr-nexpos-observer
printf '%s\n' "$revision" > "$root/deployed-revision"
trap - ERR
echo "Worker active at reviewed revision $revision"
