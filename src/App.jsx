import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Routes, Route, useParams } from 'react-router-dom';
import { 
  MapPin, Clock, Navigation, CheckCircle, 
  ChevronDown, ChevronUp, Package, UserCheck, 
  Search, AlertCircle 
} from 'lucide-react';

// Configuración de conexión con Supabase
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL, 
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// --- COMPONENTE DE GESTIÓN DE PEDIDOS ---
function ContenedorPedidos() {
  const { nombreEmpresa } = useParams();
  const [pedidos, setPedidos] = useState([]);
  const [expandido, setExpandido] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (nombreEmpresa) {
      fetchPedidos();
    }
  }, [nombreEmpresa]);

  async function fetchPedidos() {
    setCargando(true);
    const empresaLimpia = decodeURIComponent(nombreEmpresa).trim();
    
    // Consulta relacional explícita para evitar ambigüedad en la base de datos
    const { data, error } = await supabase
      .from('pedidos')
      .select('*, detalles_pedido!pedido_id(*)') 
      .ilike('empresa', empresaLimpia)
      .order('fecha', { ascending: false }); // Ordenado por el nombre real de tu columna

    if (error) {
      console.error("Error de Supabase:", error.message);
    } else {
      setPedidos(data || []);
    }
    setCargando(false);
  }

  async function confirmarEntrega(id, folio) {
    if (window.confirm(`¿Confirmar entrega del pedido #${folio}?\n\nSe eliminará permanentemente.`)) {
      const { error } = await supabase.from('pedidos').delete().eq('id', id);
      
      if (!error) {
        alert("Pedido entregado correctamente.");
        fetchPedidos();
        setExpandido(null);
      } else {
        alert("Error al procesar: " + error.message);
      }
    }
  }

  if (cargando) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-slate-500">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
        <p className="font-medium">Cargando rutas...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <header className="max-w-2xl mx-auto mb-8">
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
          <Package className="text-blue-600" size={32} /> Rutas de Entrega
        </h1>
        <p className="text-slate-500 font-medium italic mt-1">
          {decodeURIComponent(nombreEmpresa)}
        </p>
      </header>

      <main className="max-w-2xl mx-auto space-y-4 pb-12">
        {pedidos.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200">
            <Search size={48} className="mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-bold text-slate-700">Sin pedidos pendientes</h3>
          </div>
        ) : (
          pedidos.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
              
              {/* CABECERA: Resumen visible del pedido */}
              <div className="p-5 cursor-pointer" onClick={() => setExpandido(expandido === p.id ? null : p.id)}>
                <div className="flex justify-between items-start mb-3">
                  <span className="bg-blue-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full italic">#{p.folio}</span>
                  <span className="text-slate-400 text-xs font-bold flex items-center gap-1">
                    <Clock size={14}/> {p.hora_entrega || '--:--'}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-1 leading-tight">{p.nombre_cliente}</h2>
                <div className="flex items-start gap-1.5 text-slate-500 mb-3">
                  <MapPin size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm font-medium leading-tight">{p.direccion_cliente}</p>
                </div>
                
                {/* Resumen compacto de productos */}
                <div className="flex items-center gap-2 text-blue-600 text-xs font-bold mb-4">
                  <Package size={14} />
                  <span>{p.detalles_pedido?.length || 0} productos distintos</span>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                  <span className="text-2xl font-black text-emerald-600">${Number(p.total_pedido).toLocaleString('es-CL')}</span>
                  <div className="bg-slate-100 p-2 rounded-full text-slate-400">
                    {expandido === p.id ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                  </div>
                </div>
              </div>

              {/* DETALLE: Lista de productos con scroll para ahorrar espacio */}
              {expandido === p.id && (
                <div className="bg-slate-50 p-5 border-t border-slate-100">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest text-center">Detalle de Carga</h4>
                  
                  <div className="space-y-2 mb-6 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
                    {p.detalles_pedido?.map((item, index) => (
                      <div key={index} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                        <div className="flex-1 pr-4">
                          <p className="font-bold text-slate-800 text-sm truncate">{item.descripcion}</p>
                          <p className="text-[10px] text-slate-500 font-bold uppercase">
                            {item.cantidad} {item.unidad_medida} × ${Number(item.precio_unitario).toLocaleString('es-CL')}
                          </p>
                        </div>
                        <p className="font-black text-slate-700 text-sm">${Number(item.subtotal).toLocaleString('es-CL')}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <InfoBox label="Vendedor" value={p.vendedor} />
                    <InfoBox label="Entrega" value={p.fecha_entrega} />
                    <div className="col-span-2 bg-white p-3 rounded-xl border border-slate-200 flex items-center gap-3">
                      <UserCheck size={18} className="text-blue-500"/>
                      <div>
                        <p className="text-[10px] uppercase font-black text-slate-400">Recibe:</p>
                        <p className="text-sm font-bold text-slate-700">{p.quien_recibe || 'Encargado'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=$${encodeURIComponent(p.direccion_cliente)}`}
                      target="_blank" rel="noreferrer"
                      className="bg-slate-800 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 active:scale-95 transition shadow-lg"
                    >
                      <Navigation size={20}/> Iniciar GPS
                    </a>
                    <button 
                      onClick={() => confirmarEntrega(p.id, p.folio)}
                      className="bg-emerald-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 active:scale-95 transition shadow-lg"
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

// --- CONFIGURACIÓN DE RUTAS ---
export default function App() {
  return (
    <Routes>
      <Route path="/:nombreEmpresa" element={<ContenedorPedidos />} />
      <Route path="/" element={
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6 text-center font-sans">
          <div className="bg-white p-10 rounded-3xl shadow-xl max-w-sm border border-slate-200">
            <AlertCircle size={48} className="mx-auto text-amber-500 mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">Acceso Requerido</h2>
            <p className="text-slate-600 text-sm leading-relaxed">
              Ingresa el nombre de la empresa en la URL para visualizar tus pedidos de delivery.
            </p>
          </div>
        </div>
      } />
    </Routes>
  );
}

function InfoBox({ label, value }) {
  return (
    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
      <p className="text-[10px] uppercase font-black text-slate-400 mb-0.5 tracking-wider">{label}</p>
      <p className="text-xs font-bold text-slate-700">{value || '---'}</p>
    </div>
  );
}