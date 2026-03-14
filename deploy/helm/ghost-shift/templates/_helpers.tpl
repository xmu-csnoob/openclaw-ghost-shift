{{- define "ghost-shift.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "ghost-shift.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "ghost-shift.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "ghost-shift.labels" -}}
app.kubernetes.io/name: {{ include "ghost-shift.name" . }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end -}}

{{- define "ghost-shift.selectorLabels" -}}
app.kubernetes.io/name: {{ include "ghost-shift.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "ghost-shift.serviceName" -}}
{{- if .Values.service.nameOverride -}}
{{- .Values.service.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- include "ghost-shift.fullname" . -}}
{{- end -}}
{{- end -}}
