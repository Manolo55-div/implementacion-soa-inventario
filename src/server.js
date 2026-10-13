
/**
 * Microservicio de Inventario - Arquitectura SOA Desacoplada
 * Diseñado bajo estándares REST y principios de tolerancia a fallos.
 */

const express = require('express');
const app = express();


app.use(express.json());


// 1. SIMULACIÓN DE BASE DE DATOS PRIVADA 

let stockProductos = [
  { sku: 'SKU-220', nombre: 'Sérum Facial Hialurónico', stock: 45, almacen: 'Bogotá-Central' },
  { sku: 'SKU-310', nombre: 'Protector Solar SPF 50+', stock: 12, almacen: 'Bogotá-Central' },
  { sku: 'SKU-405', nombre: 'Crema Antiedad Retinol', stock: 0, almacen: 'Bogotá-Central' }
];

let reservasDB = [];


// 2. MIDDLEWARE DE RESILIENCIA (Simulador de Caída / Circuit Breaker)

let sistemaEstable = true;

app.use((req, res, next) => {
  if (!sistemaEstable && !req.path.includes('/admin')) {
    res.setHeader('Retry-After', '5');
    return res.status(503).json({
      error: 'Servicio de Inventario no disponible temporalmente',
      mensaje: 'El servidor está experimentando alta carga. Intente nuevamente más tarde.'
    });
  }
  next();
});


// 3. ENDPOINTS DEL CONTRATO REST (Inventario)


/**
 * GET /api/v1/productos/:id/disponibilidad
 * Consulta las unidades disponibles de un producto específico.
 */
app.get('/api/v1/productos/:id/disponibilidad', (req, res) => {
  const productoId = req.params.id.toUpperCase();
  const producto = stockProductos.find(p => p.sku === productoId);

  if (!producto) {
    return res.status(404).json({
      success: false,
      error: 'Producto no encontrado en el dominio de inventario.'
    });
  }

  return res.status(200).json({
    success: true,
    productoId: producto.sku,
    nombre: producto.nombre,
    stockDisponible: producto.stock,
    estado: producto.stock > 0 ? 'DISPONIBLE' : 'AGOTADO'
  });
});

/**
 * POST /api/v1/reservas
 * Solicita reservar stock de manera asíncrona (Retorna 202 Accepted).
 */
app.post('/api/v1/reservas', (req, res) => {
  const { pedidoId, items } = req.body;

  if (!pedidoId || !items || !Array.isArray(items)) {
    return res.status(400).json({
      success: false,
      error: 'Solicitud incorrecta. Se requiere un "pedidoId" y un arreglo de "items".'
    });
  }

  const reservaId = `R-${Math.floor(Math.random() * 90000) + 10000}`;
  
  const nuevaReserva = {
    reservaId,
    pedidoId,
    items,
    estado: 'PENDIENTE',
    fechaCreacion: new Date().toISOString()
  };

  reservasDB.push(nuevaReserva);

  return res.status(202).json({
    success: true,
    reservaId: reservaId,
    estado: 'PENDIENTE',
    consultarEstado: `/api/v1/reservas/${reservaId}`,
    mensaje: 'Reserva aceptada para procesamiento en segundo plano.'
  });
});

/**
 * GET /api/v1/reservas/:id
 * Consulta el estado actual de una reserva de inventario.
 */
app.get('/api/v1/reservas/:id', (req, res) => {
  const reserva = reservasDB.find(r => r.reservaId === req.params.id);

  if (!reserva) {
    return res.status(404).json({
      success: false,
      error: 'La reserva especificada no existe.'
    });
  }

  return res.status(200).json({
    success: true,
    data: reserva
  });
});

/**
 * DELETE /api/v1/reservas/:id
 * Libera una reserva si el pago o el pedido fallan.
 */
app.delete('/api/v1/reservas/:id', (req, res) => {
  const index = reservasDB.findIndex(r => r.reservaId === req.params.id);

  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Reserva no encontrada para liberar.' });
  }

  reservasDB.splice(index, 1);
  return res.status(204).send(); // Corregido: res.status
});


// 4. ENDPOINT ADMINISTRATIVO (Para simular fallos de arquitectura)

app.post('/api/v1/admin/toggle-estres', (req, res) => {
  sistemaEstable = !sistemaEstable;
  return res.status(200).json({ // Corregido: res.status
    mensaje: `Simulación de fallo cambiada. Inventario operando de forma normal: ${sistemaEstable}`
  });
});

// ==========================================
// 5. INICIALIZACIÓN DEL SERVIDOR
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[MICROSERVICIO DE INVENTARIO] Escuchando en el puerto ${PORT}`);
  console.log(`[CONTRATO REST ACTIVO] Base de datos aislada en memoria lista.`);
});