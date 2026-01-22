import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Configuración de Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function App() {
  const [pedidos, setPedidos] = useState([]);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  const empresaNombre = "NOMBRE_DE_TU_EMPRESA"; // Esto debe coincidir con lo que envías desde C#

  useEffect(() => {
    fetchPedidos();
  }, []);

  async function fetchPedidos() {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq('empresa', empresaNombre)
      .order('created_at', { ascending: false });
    
    if (error) console.error('Error:', error);
    else setPedidos(data);
  }

  async function eliminarPedido(id) {
    const confirmar = window.confirm("¿Confirmar despacho y eliminar pedido?");
    if (confirmar) {
      const { error } = await supabase.from('pedidos').delete().eq('id', id);
      if (!error) fetchPedidos();
    }
  }

  return (
    <div className="container" style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Panel de Pedidos: {empresaNombre}</h1>
      
      <table border="1" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f4f4f4' }}>
            <th>Folio</th>
            <th>Cliente</th>
            <th>Producto</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {pedidos.map((p) => (
            <tr key={p.id} onClick={() => setPedidoSeleccionado(p)} style={{ cursor: 'pointer' }}>
              <td>{p.folio}</td>
              <td>{p.nombre_cliente}</td>
              <td>{p.producto} (x{p.cantidad})</td>
              <td>
                <button 
                  onClick={(e) => { e.stopPropagation(); eliminarPedido(p.id); }}
                  style={{ background: '#ff4d4d', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px' }}
                >
                  Despachado
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {pedidoSeleccionado && (
        <div style={{ marginTop: '20px', padding: '20px', border: '2px solid #007bff', borderRadius: '8px', background: '#f9f9f9' }}>
          <h2>Detalles del Pedido #{pedidoSeleccionado.folio}</h2>
          <p><strong>Cliente:</strong> {pedidoSeleccionado.nombre_cliente}</p>
          
          {/* Solo muestra el RUT si es factura */}
          {pedidoSeleccionado.es_factura && (
            <p><strong>RUT:</strong> {pedidoSeleccionado.rut_cliente}</p>
          )}

          <p><strong>Dirección:</strong> {pedidoSeleccionado.direccion_cliente}</p>
          <p><strong>Vendedor:</strong> {pedidoSeleccionado.vendedor}</p>
          <p><strong>Comentario:</strong> {pedidoSeleccionado.comentario}</p>
          <hr />
          <p><strong>Total:</strong> ${pedidoSeleccionado.total}</p>
          <button onClick={() => setPedidoSeleccionado(null)}>Cerrar</button>
        </div>
      )}
    </div>
  );
}

export default App;