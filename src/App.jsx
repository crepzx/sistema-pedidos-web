import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Routes, Route, useParams } from 'react-router-dom';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Este es el componente que muestra los datos
function PanelPedidos() {
  const { nombreEmpresa } = useParams(); // Captura "nombre-empresa" de la URL
  const [pedidos, setPedidos] = useState([]);
  
  // Limpiamos el nombre de la URL (convierte %20 en espacios)
  const empresaLimpia = decodeURIComponent(nombreEmpresa);

  useEffect(() => {
    if (empresaLimpia) {
      fetchPedidos();
    }
  }, [empresaLimpia]);

  async function fetchPedidos() {
    const { data, error } = await supabase
      .from('pedidos')
      .select('*')
      .eq('empresa', empresaLimpia) // Filtra exacto por el nombre en la URL
      .order('created_at', { ascending: false });
    
    if (error) console.error(error);
    else setPedidos(data);
  }

  return (
    <div>
      <h1>Pedidos de: {empresaLimpia}</h1>
      {pedidos.length === 0 ? (
        <p>No hay pedidos para esta empresa o revisa el nombre.</p>
      ) : (
        <table border="1" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Folio</th>
              <th>Cliente</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map(p => (
              <tr key={p.id}>
                <td>{p.folio}</td>
                <td>{p.nombre_cliente}</td>
                <td>${Number(p.total).toLocaleString('es-CL')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Configuración de las rutas
function App() {
  return (
    <Routes>
      {/* La ruta dice que después de la barra viene una variable llamada nombreEmpresa */}
      <Route path="/:nombreEmpresa" element={<PanelPedidos />} />
      <Route path="/" element={<h2>Por favor, ingresa el nombre de una empresa en la URL.</h2>} />
    </Routes>
  );
}

export default App;