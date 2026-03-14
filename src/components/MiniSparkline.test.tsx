import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { MiniSparkline } from './MiniSparkline.js'

describe('MiniSparkline', () => {
  test('renders area and line paths for multi-point series', () => {
    const { container } = render(<MiniSparkline values={[0, 5, 10]} />)

    const paths = container.querySelectorAll('path')
    expect(paths).toHaveLength(2)
    expect(paths[0]).toHaveAttribute('d', 'M0.00,52.00 L90.00,26.00 L180.00,0.00 L180,52 L0,52 Z')
    expect(paths[1]).toHaveAttribute('d', 'M0.00,52.00 L90.00,26.00 L180.00,0.00')
  })

  test('centers a single point and omits output for empty series', () => {
    const single = render(<MiniSparkline values={[4]} width={100} height={20} />)
    expect(single.container.querySelectorAll('path')[1]).toHaveAttribute('d', 'M50.00,0.00')

    single.unmount()

    const empty = render(<MiniSparkline values={[]} />)
    expect(empty.container.querySelectorAll('path')).toHaveLength(0)
  })
})
