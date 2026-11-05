import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizarServicios, totalProp, totalServicios, resumenEncargo } from '../src/reglas.js'

const coord = { rol: 'admin' }
const apoyo = { rol: 'usuario' }
const hoy = '2026-11-02'

test('propuesta: exige al menos un servicio con nombre', () => {
  assert.throws(() => normalizarServicios([]), /al menos un servicio/)
  assert.throws(() => normalizarServicios([{ servicio: '  ', importe: 10 }]), /no tiene nombre/)
})

test('propuesta: importes inválidos se rechazan y los no confirmados quedan marcados', () => {
  assert.throws(() => normalizarServicios([{ servicio: 'DJ', importe: -1 }]), /no es válido/)
  assert.throws(() => normalizarServicios([{ servicio: 'DJ', importe: 'abc' }]), /no es válido/)
  const [dj, son] = normalizarServicios([{ servicio: ' DJ ', importe: 450000 }, { servicio: 'Sonido', importe: '700000', importe_confirmado: true, proveedor_id: '4' }])
  assert.equal(dj.servicio, 'DJ')
  assert.equal(dj.importe_confirmado, false) // por defecto es "estimado": no se presenta como compromiso
  assert.equal(son.importe, 700000)
  assert.equal(son.proveedor_id, 4)
})

test('propuesta: el total es la suma de los servicios', () => {
  assert.equal(totalProp({ propuesta_servicios: [{ importe: 450000 }, { importe: '700000.50' }, { importe: 0 }] }), 1150000.5)
  assert.equal(totalProp({}), 0)
})

test('total del evento: ignora servicios quitados y se oculta para apoyo', () => {
  const s = [{ importe: 100, activo: true }, { importe: 50, activo: false }, { importe: 25, activo: true }]
  assert.equal(totalServicios(s, coord), 125)
  assert.equal(totalServicios(s, apoyo), null)
})

const ev = (extra = {}) => ({
  estado: 'en_preparacion', fecha: '2026-11-20',
  encargo_servicios: [
    { activo: true, participacion: 'confirmada', proveedor_id: 1, importe: 10 },
    { activo: true, participacion: 'disponibilidad_informada', proveedor_id: 2, importe: 10 },
    { activo: true, participacion: 'pendiente', proveedor_id: null, importe: 10, revisar: true },
    { activo: true, participacion: 'rechazada', proveedor_id: 3, importe: 10 },
    { activo: false, participacion: 'pendiente', proveedor_id: 4, importe: 99 },
  ],
  tareas: [
    { estado: 'pendiente', fecha_prevista: '2026-10-30' }, { estado: 'en_curso', fecha_prevista: '2026-11-10' },
    { estado: 'completada', fecha_prevista: '2026-10-01' }, { estado: 'cancelada', fecha_prevista: '2026-10-01' }, { estado: 'pendiente', fecha_prevista: null, revisar: true },
  ],
  cambios: [{ estado: 'pendiente_conformidad' }, { estado: 'vigente' }],
  incidentes: [{ pendiente: 'Hablar con el DJ' }, { pendiente: '' }, { pendiente: null }],
  ...extra,
})

test('pendientes: "dijo que está disponible" NO cuenta como confirmado', () => {
  const r = resumenEncargo(ev(), hoy, coord)
  assert.equal(r.servicios_total, 4)           // el quitado no cuenta
  assert.equal(r.servicios_confirmados, 1)
  assert.equal(r.servicios_sin_confirmar, 2)   // disponibilidad informada + pendiente
  assert.equal(r.servicios_rechazados, 1)
  assert.equal(r.servicios_sin_proveedor, 1)   // el rechazado no se cuenta como "falta elegir"
})

test('pendientes: tareas abiertas, vencidas y para revisar', () => {
  const r = resumenEncargo(ev(), hoy, coord)
  assert.equal(r.tareas_abiertas, 3)
  assert.equal(r.tareas_vencidas, 1)           // las completadas/canceladas nunca vencen
  assert.equal(r.para_revisar, 2)              // un servicio + una tarea
  assert.equal(r.cambios_pendientes, 1)
  assert.equal(r.incidentes_pendientes, 1)
})

test('"por cerrar": solo eventos abiertos cuya fecha ya pasó', () => {
  assert.equal(resumenEncargo(ev({ fecha: '2026-10-30' }), hoy, coord).por_cerrar, true)
  assert.equal(resumenEncargo(ev({ fecha: '2026-11-02' }), hoy, coord).por_cerrar, false)   // hoy mismo no
  assert.equal(resumenEncargo(ev({ fecha: '2026-10-30', estado: 'realizado' }), hoy, coord).por_cerrar, false)
  assert.equal(resumenEncargo(ev({ fecha: '2026-10-30', estado: 'cancelado' }), hoy, coord).por_cerrar, false)
})

test('días para el evento y confidencialidad del total', () => {
  assert.equal(resumenEncargo(ev(), hoy, coord).dias_para_evento, 18)
  assert.equal(resumenEncargo(ev(), hoy, coord).total, 40)
  assert.equal(resumenEncargo(ev(), hoy, apoyo).total, null)
})

test('cancelación: avisos pendientes a proveedores', () => {
  const r = resumenEncargo(ev({ estado: 'cancelado', encargo_servicios: [{ activo: true, aviso_cancelacion: 'pendiente' }, { activo: true, aviso_cancelacion: 'avisado' }] }), hoy, coord)
  assert.equal(r.avisos_pendientes, 1)
})

// ---------- Límites y validaciones (lo que evita datos absurdos) ----------
import { personas, fechaFutura, dinero, LIMITES, hoyAR, sumarDias } from '../src/util.js'

test('personas: acepta lo razonable y rechaza lo absurdo', () => {
  assert.equal(personas(300), 300)
  assert.throws(() => personas(1_000_000_000), /no puede superar/)
  assert.throws(() => personas(LIMITES.asistentes + 1), /no puede superar/)
  assert.throws(() => personas(0), /al menos 1/)
  assert.throws(() => personas(-5), /al menos/)
  assert.throws(() => personas(2.5), /entero/)
  assert.throws(() => personas('abc'), /entero/)
  assert.equal(personas(0, { min: 0 }), 0)
})
test('fechaFutura: hoy en adelante y hasta 3 años', () => {
  assert.equal(fechaFutura(hoyAR()), hoyAR())
  assert.throws(() => fechaFutura(sumarDias(hoyAR(), -1)), /de hoy en adelante/)
  assert.throws(() => fechaFutura(sumarDias(hoyAR(), 365 * 4)), /3 años/)
  assert.throws(() => fechaFutura('2026-13-45'), /no es válida/)
})
test('dinero: no negativo y con tope', () => {
  assert.equal(dinero(1500.5), 1500.5)
  assert.throws(() => dinero(-1), /no es válido/)
  assert.throws(() => dinero(LIMITES.importe + 1), /demasiado alto/)
  assert.throws(() => dinero('x'), /no es válido/)
})
test('propuesta: los importes también tienen tope', () => {
  assert.throws(() => normalizarServicios([{ servicio: 'DJ', importe: 9e12 }]), /demasiado alto/)
  assert.equal(normalizarServicios([{ servicio: 'DJ', importe: 250000 }])[0].importe, 250000)
})
