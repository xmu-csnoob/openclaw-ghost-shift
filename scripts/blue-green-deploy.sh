#!/bin/sh
set -eu

usage() {
  cat <<'EOF'
Usage:
  blue-green-deploy.sh deploy <blue|green> [image-tag]
  blue-green-deploy.sh switch <blue|green>
  blue-green-deploy.sh status
  blue-green-deploy.sh cleanup <blue|green>

Environment:
  RELEASE_PREFIX      Helm release prefix, default ghost-shift
  NAMESPACE           Kubernetes namespace, default ghost-shift
  CHART_DIR           Helm chart path
  VALUES_FILE         Optional Helm values file
  STABLE_SERVICE_NAME Stable Service name, default ghost-shift-active
  HOST                Optional ingress host for the stable service
  INGRESS_CLASS       Optional ingress class, default nginx
  TLS_SECRET_NAME     Optional ingress TLS secret, default ghost-shift-tls
  CORS_ALLOW_ORIGIN   Optional allowed browser origin for ingress CORS
  LIMIT_RPS           Optional ingress request rate limit, default 20
EOF
}

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
CHART_DIR=${CHART_DIR:-"$ROOT_DIR/deploy/helm/ghost-shift"}
RELEASE_PREFIX=${RELEASE_PREFIX:-ghost-shift}
NAMESPACE=${NAMESPACE:-ghost-shift}
VALUES_FILE=${VALUES_FILE:-}
STABLE_SERVICE_NAME=${STABLE_SERVICE_NAME:-ghost-shift-active}
HOST=${HOST:-}
INGRESS_CLASS=${INGRESS_CLASS:-nginx}
TLS_SECRET_NAME=${TLS_SECRET_NAME:-ghost-shift-tls}
CORS_ALLOW_ORIGIN=${CORS_ALLOW_ORIGIN:-https://portfolio.example.com}
LIMIT_RPS=${LIMIT_RPS:-20}

require_color() {
  case ${1:-} in
    blue|green) ;;
    *)
      usage >&2
      exit 1
      ;;
  esac
}

deploy_color() {
  color=$1
  image_tag=${2:-}
  release="${RELEASE_PREFIX}-${color}"

  set -- upgrade --install "$release" "$CHART_DIR" --namespace "$NAMESPACE" --create-namespace \
    --set fullnameOverride="$release" \
    --set service.nameOverride="$release" \
    --set ingress.enabled=false \
    --set config.GHOST_SHIFT_INSTANCE_ID="$release" \
    --set-string podLabels.ghost-shift\\.dev/color="$color"

  if [ -n "$VALUES_FILE" ]; then
    set -- "$@" --values "$VALUES_FILE"
  fi

  if [ -n "$image_tag" ]; then
    set -- "$@" --set image.tag="$image_tag"
  fi

  helm "$@"
  printf 'Deployed %s in namespace %s\n' "$release" "$NAMESPACE"
}

apply_stable_service() {
  color=$1
  cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Service
metadata:
  name: ${STABLE_SERVICE_NAME}
  namespace: ${NAMESPACE}
  labels:
    app.kubernetes.io/name: ghost-shift
spec:
  type: ClusterIP
  selector:
    app.kubernetes.io/name: ghost-shift
    ghost-shift.dev/color: ${color}
  ports:
    - name: http
      port: 80
      targetPort: http
      protocol: TCP
EOF
}

apply_stable_ingress() {
  if [ -z "$HOST" ]; then
    return 0
  fi

  cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${STABLE_SERVICE_NAME}
  namespace: ${NAMESPACE}
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/enable-cors: "true"
    nginx.ingress.kubernetes.io/cors-allow-origin: "${CORS_ALLOW_ORIGIN}"
    nginx.ingress.kubernetes.io/cors-allow-methods: "GET, OPTIONS"
    nginx.ingress.kubernetes.io/cors-allow-headers: "Authorization, Content-Type, X-Request-ID"
    nginx.ingress.kubernetes.io/limit-rps: "${LIMIT_RPS}"
    nginx.ingress.kubernetes.io/limit-burst-multiplier: "3"
spec:
  ingressClassName: ${INGRESS_CLASS}
  tls:
    - secretName: ${TLS_SECRET_NAME}
      hosts:
        - ${HOST}
  rules:
    - host: ${HOST}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: ${STABLE_SERVICE_NAME}
                port:
                  number: 80
EOF
}

show_status() {
  active_color=""
  if kubectl -n "$NAMESPACE" get service "$STABLE_SERVICE_NAME" >/dev/null 2>&1; then
    active_color=$(kubectl -n "$NAMESPACE" get service "$STABLE_SERVICE_NAME" -o jsonpath='{.spec.selector.ghost-shift\.dev/color}')
  fi

  printf 'Active color: %s\n' "${active_color:-unknown}"
  kubectl -n "$NAMESPACE" get deploy -l app.kubernetes.io/name=ghost-shift
}

cleanup_color() {
  color=$1
  helm uninstall "${RELEASE_PREFIX}-${color}" --namespace "$NAMESPACE"
}

command=${1:-}
case "$command" in
  deploy)
    require_color "${2:-}"
    deploy_color "$2" "${3:-}"
    ;;
  switch)
    require_color "${2:-}"
    apply_stable_service "$2"
    apply_stable_ingress
    printf 'Switched stable traffic to %s\n' "$2"
    ;;
  status)
    show_status
    ;;
  cleanup)
    require_color "${2:-}"
    cleanup_color "$2"
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac
