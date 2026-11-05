import { useEffect, useState } from 'react'

// Router mínimo por hash: #/eventos/12/editar?x=1 → { segs: ['eventos','12','editar'], query: {x:'1'} }
const parse = () => {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const [path, qs] = raw.split('?')
  return { segs: path.split('/').filter(Boolean), query: Object.fromEntries(new URLSearchParams(qs || '')), raw }
}
export function useRoute() {
  const [r, setR] = useState(parse)
  useEffect(() => {
    const f = () => { setR(parse()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return r
}
export const ir = (ruta) => { window.location.hash = '#/' + ruta.replace(/^\//, '') }
