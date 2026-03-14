interface MiniSparklineProps {
  values: number[]
  width?: number
  height?: number
  stroke?: string
  fill?: string
  strokeWidth?: number
}

function buildLine(values: number[], width: number, height: number): string {
  if (values.length === 0) return ''

  const maxValue = Math.max(...values, 1)
  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width
      const y = height - ((value || 0) / maxValue) * height
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

function buildArea(values: number[], width: number, height: number): string {
  const line = buildLine(values, width, height)
  if (!line) return ''
  return `${line} L${width},${height} L0,${height} Z`
}

export function MiniSparkline({
  values,
  width = 180,
  height = 52,
  stroke = '#7db3ff',
  fill = 'rgba(125, 179, 255, 0.12)',
  strokeWidth = 2.5,
}: MiniSparklineProps) {
  const line = buildLine(values, width, height)
  const area = buildArea(values, width, height)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden="true">
      {area ? <path d={area} fill={fill} /> : null}
      {line ? <path d={line} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" /> : null}
    </svg>
  )
}
