// Catálogos compartidos (clientes, sedes, proveedores, equipo): se cargan una vez y se reutilizan.
import { useEffect, useState, useCallback } from 'react'
import { api } from './api.js'

const cache = {}
const oyentes = new Set()
const RUTAS = { clientes: '/clientes', sedes: '/sedes', proveedores: '/proveedores', equipo: '/equipo' }

export const invalidar = (nombre) => { delete cache[nombre]; oyentes.forEach((f) => f()) }
export function cargar(nombre) {
  if (!cache[nombre]) cache[nombre] = api(RUTAS[nombre]).catch((e) => { delete cache[nombre]; throw e })
  return cache[nombre]
}
export function useCatalogo(nombre) {
  const [data, setData] = useState(null)
  const [n, setN] = useState(0)
  useEffect(() => {
    const f = () => setN((x) => x + 1)
    oyentes.add(f)
    return () => oyentes.delete(f)
  }, [])
  useEffect(() => {
    let vivo = true
    cargar(nombre).then((d) => vivo && setData(d)).catch(() => vivo && setData([]))
    return () => { vivo = false }
  }, [nombre, n])
  return data || []
}
export const limpiarCatalogos = () => { Object.keys(cache).forEach((k) => delete cache[k]) }
