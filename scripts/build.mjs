import { cp, readFile, rm, writeFile } from 'node:fs/promises'

let build
try {
  ;({ build } = await import('esbuild'))
} catch (error) {
  throw new Error(
    `Failed to load esbuild. Run npm install before building.\n${error instanceof Error ? error.message : String(error)}`,
  )
}

const outdir = 'dist'

await rm(outdir, { recursive: true, force: true })

const result = await build({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  format: 'esm',
  splitting: true,
  target: ['es2022'],
  jsx: 'automatic',
  minify: true,
  outdir,
  entryNames: 'assets/[name]-[hash]',
  chunkNames: 'assets/[name]-[hash]',
  assetNames: 'assets/[name]-[hash]',
  metafile: true,
  define: {
    'import.meta.env.VITE_PUBLIC_API_BASE': JSON.stringify(process.env.VITE_PUBLIC_API_BASE || ''),
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
})

await cp('public', outdir, { recursive: true, force: true })

const entryOutput = Object.entries(result.metafile.outputs).find(
  ([, meta]) => meta.entryPoint === 'src/main.tsx',
)

if (!entryOutput) {
  throw new Error('Failed to find the frontend entry bundle.')
}

const [entryScript, entryMeta] = entryOutput
const entryStylesheet = entryMeta.cssBundle || ''

const indexHtml = await readFile('index.html', 'utf8')
const assetTags = [
  entryStylesheet
    ? `    <link rel="stylesheet" href="./${entryStylesheet.replace(`${outdir}/`, '')}" />`
    : '',
  `    <script type="module" src="./${entryScript.replace(`${outdir}/`, '')}"></script>`,
]
  .filter(Boolean)
  .join('\n')

const outputHtml = indexHtml.replace(
  '    <script type="module" src="/src/main.tsx"></script>',
  assetTags,
)

await writeFile(`${outdir}/index.html`, outputHtml)
