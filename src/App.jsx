import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Routes, Route, useParams } from 'react-router-dom';
import { 
  MapPin, Clock, Navigation, CheckCircle, 
  ChevronDown, ChevronUp, Package, UserCheck, 
  Search, AlertCircle 
} from 'lucide-react';

// Configuración de Supabase usando variables de entorno de Vite
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL, 
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// --- COMPONENTE PRINCIPAL DE PEDIDOS ---
function ContenedorPedidos() {
  const { nombreEmpresa } = useParams();
  const [pedidos, setPedidos] = useState([]);
  const [expandido, setExpandido] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Efecto para cargar datos cada vez que cambia la URL
  useEffect(() => {
    if (nombreEmpresa) {
      fetchPedidos();
    }
  }, [nombreEmpresa]);

  async function fetchPedidos() {
    setCargando(true);
    const empresaLimpia = decodeURIComponent(nombreEmpresa).trim();
    
    console.log("Iniciando búsqueda para:", empresaLimpia);

    // Consulta relacional: Trae el pedido y todos sus productos asociados
    const { data, error } = await supabase
      .from('pedidos')
      .select('*, detalles_pedido(*)') 
      .ilike('empresa', empresaLimpia) // Búsqueda flexible (ignora mayúsculas)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error de Supabase:", error.message);
    } else {
      console.log("Pedidos encontrados:", data.length);
      setPedidos(data || []);
    }
    setCargando(false);
  }

  async function confirmarEntrega(id, folio) {
    const confirmar = window.confirm(
      `¿Confirmar entrega del pedido #${folio}?\n\nEl registro se eliminará de la base de datos.`
    );

    if (confirmar) {
      // Al borrar el pedido, el 'ON DELETE CASCADE' de tu SQL borra los productos automáticamente
      const { error } = await supabase.from('pedidos').delete().eq('id', id);
      
      if (!error) {
        alert("Pedido entregado correctamente.");
        fetchPedidos(); // Recargar lista
        setExpandido(null);
      } else {
        alert("Error al procesar la entrega: " + error.message);
      }
    }
  }

  if (cargando) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-slate-500">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
        <p className="font-medium">Buscando rutas de entrega...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <header className="max-w-2xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Package size={24} />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Rutas de Entrega</h1>
        </div>
        <p className="text-slate-500 font-medium italic">
          Empresa: {decodeURIComponent(nombreEmpresa)}
        </p>
      </header>

      <main className="max-w-2xl mx-auto space-y-4 pb-10">
        {pedidos.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-slate-200">
            <Search size={48} className="mx-auto mb-4 text-slate-300 opacity-50" />
            <h3 className="text-lg font-bold text-slate-700">No hay pedidos pendientes</h3>
            <p className="text-slate-500 text-sm">Los pedidos aparecerán aquí cuando se envíen desde el sistema C#.</p>
          </div>
        ) : (
          pedidos.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden transition-all">
              
              {/* VISTA RESUMIDA */}
              <div 
                className="p-5 cursor-pointer hover:bg-slate-50" 
                onClick={() => setExpandido(expandido === p.id ? null : p.id)}
              >
                <div className="flex justify-between items-start mb-3">
                  <span className="bg-blue-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full italic tracking-tighter">
                    #{p.folio}
                  </span>
                  <span className="text-slate-400 text-xs font-bold flex items-center gap-1">
                    <Clock size={14}/> {p.hora_entrega || '--:--'}
                  </span>
                </div>
                
                <h2 className="text-xl font-bold text-slate-800 mb-1">{p.nombre_cliente}</h2>
                
                <div className="flex items-start gap-1.5 text-slate-500">
                  <MapPin size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm font-medium leading-tight">{p.direccion_cliente}</p>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-2xl font-black text-emerald-600">
                    ${Number(p.total_pedido).toLocaleString('es-CL')}
                  </span>
                  <div className="bg-slate-100 p-2 rounded-full text-slate-400">
                    {expandido === p.id ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                  </div>
                </div>
              </div>

              {/* DETALLE EXPANDIDO */}
              {expandido === p.id && (
                <div className="bg-slate-50 p-5 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                  <h4 className="text-xs font-black uppercase text-slate-400 mb-3 tracking-widest">Productos</h4>
                  
                  <div className="space-y-2 mb-6">
                    {p.detalles_pedido && p.detalles_pedido.length > 0 ? (
                      p.detalles_pedido.map((item, index) => (
                        <div key={index} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                          <div>
                            <p className="font-bold text-slate-800 text-sm">{item.descripcion}</p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase">
                              {item.cantidad} {item.unidad_medida} × ${Number(item.precio_unitario).toLocaleString('es-CL')}
                            </p>
                          </div>
                          <p className="font-black text-slate-700">${Number(item.subtotal).toLocaleString('es-CL')}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic">No hay detalles registrados para este pedido.</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <InfoBox label="Vendedor" value={p.vendedor} />
                    <InfoBox label="Fecha" value={p.fecha_entrega} />
                    <div className="col-span-2 bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-3">
                      <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                        <UserCheck size={18}/>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-black text-slate-400">Persona que recibe:</p>
                        <p className="text-sm font-bold text-slate-700">{p.quien_recibe || 'Titular o encargado'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.direccion_cliente)}`}
                      target="_blank" 
                      rel="noreferrer"
                      className="bg-slate-800 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-slate-700 active:scale-95 transition-all shadow-lg"
                    >
                      <Navigation size={20}/> Abrir Google Maps
                    </a>
                    <button 
                      onClick={() => confirmarEntrega(p.id, p.folio)}
                      className="bg-emerald-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-emerald-700 active:scale-95 transition-all shadow-lg"
                    >
                      <CheckCircle size={20}/> Confirmar Entrega
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </main>
    </div>
  );
}

// --- COMPONENTE DE ENRUTAMIENTO ---
export default function App() {
  return (
    <Routes>
      {/* El :nombreEmpresa es vital para que useParams() funcione */}
      <Route path="/:nombreEmpresa" element={<ContenedorPedidos />} />
      <Route path="/" element={
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6 text-center">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm border border-slate-200">
            <AlertCircle size={48} className="mx-auto text-amber-500 mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">Acceso no válido</h2>
            <p className="text-slate-600 text-sm">
              Por favor, utiliza el enlace directo con el nombre de tu empresa para ver los pedidos.
            </p>
          </div>
        </div>
      } />
    </Routes>
  );
}

// Sub-componente visual
function InfoBox({ label, value }) {
  return (
    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
      <p className="text-[10px] uppercase font-black text-slate-400 mb-0.5 tracking-wider">{label}</p>
      <p className="text-xs font-bold text-slate-700">{value || '---'}</p>
    </div>
  );
}