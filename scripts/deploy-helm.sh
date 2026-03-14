#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
CHART_DIR=${CHART_DIR:-"$ROOT_DIR/deploy/helm/ghost-shift"}
RELEASE=${RELEASE:-ghost-shift}
NAMESPACE=${NAMESPACE:-ghost-shift}
VALUES_FILE=${VALUES_FILE:-}
IMAGE_TAG=${IMAGE_TAG:-}
WARMUP_URL=${WARMUP_URL:-}

set -- upgrade --install "$RELEASE" "$CHART_DIR" --namespace "$NAMESPACE" --create-namespace "$@"

if [ -n "$VALUES_FILE" ]; then
  set -- "$@" --values "$VALUES_FILE"
fi

if [ -n "$IMAGE_TAG" ]; then
  set -- "$@" --set image.tag="$IMAGE_TAG"
fi

helm "$@"

if [ -n "$WARMUP_URL" ]; then
  "$ROOT_DIR/scripts/warm-cache.sh" "$WARMUP_URL"
fi
