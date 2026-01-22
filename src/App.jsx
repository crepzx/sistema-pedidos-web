import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Routes, Route, useParams } from 'react-router-dom';
import { 
  MapPin, Clock, Navigation, CheckCircle, 
  ChevronDown, ChevronUp, Package, UserCheck, 
  Search, AlertCircle 
} from 'lucide-react';

// Inicialización del cliente de Supabase
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
    
    // Consulta relacional explícita para evitar errores de ambigüedad
    const { data, error } = await supabase
      .from('pedidos')
      .select('*, detalles_pedido!pedido_id(*)') 
      .ilike('empresa', empresaLimpia)
      .order('fecha', { ascending: false }); // Ordenado por columna 'fecha' según tu DB

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
    <div className="min-h-screen bg-slate-50 p-2 sm:p-4 md:p-8 font-sans text-slate-900">
      <header className="w-full max-w-md mx-auto mb-6 px-2">
        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
          <Package className="text-blue-600 shrink-0" size={28} /> Rutas de Entrega
        </h1>
        <p className="text-slate-500 text-xs font-bold italic mt-1 break-words">
          {decodeURIComponent(nombreEmpresa)}
        </p>
      </header>

      <main className="w-full max-w-md mx-auto space-y-4 pb-12 px-2">
        {pedidos.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-slate-200">
            <Search size={40} className="mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-bold text-slate-700">Sin pedidos pendientes</h3>
          </div>
        ) : (
          pedidos.map((p) => (
            <div key={p.id} className="w-full bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
              
              {/* CABECERA DE LA TARJETA */}
              <div className="p-4 cursor-pointer w-full" onClick={() => setExpandido(expandido === p.id ? null : p.id)}>
                <div className="flex justify-between items-center mb-2 gap-2">
                  <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full italic shrink-0">
                    #{p.folio}
                  </span>
                  <span className="text-slate-400 text-[10px] font-bold flex items-center gap-1 shrink-0">
                    <Clock size={12}/> {p.hora_entrega || '--:--'}
                  </span>
                </div>
                
                <h2 className="text-lg font-bold text-slate-800 mb-1 leading-tight break-words">
                  {p.nombre_cliente}
                </h2>
                
                <div className="flex items-start gap-1.5 text-slate-500 mb-3">
                  <MapPin size={16} className="text-red-500 mt-1 shrink-0" />
                  <p className="text-xs font-medium leading-tight break-words">
                    {p.direccion_cliente}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-blue-600 text-[10px] font-black uppercase mb-4">
                  <Package size={14} />
                  <span>{p.detalles_pedido?.length || 0} productos distintos</span>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-between items-center w-full">
                  <span className="text-xl font-black text-emerald-600 shrink-0">
                    ${Number(p.total_pedido).toLocaleString('es-CL')}
                  </span>
                  <div className="bg-slate-100 p-1.5 rounded-full text-slate-400">
                    {expandido === p.id ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                  </div>
                </div>
              </div>

              {/* DETALLE EXPANDIDO */}
              {expandido === p.id && (
                <div className="bg-slate-50 p-4 border-t border-slate-100 w-full overflow-hidden">
                  <h4 className="text-[9px] font-black uppercase text-slate-400 mb-3 tracking-widest text-center">Detalle de Carga</h4>
                  
                  {/* Lista de productos con Scroll interno */}
                  <div className="space-y-2 mb-6 max-h-52 overflow-y-auto w-full pr-1 custom-scrollbar">
                    {p.detalles_pedido?.map((item, index) => (
                      <div key={index} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm w-full gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-800 text-xs truncate">{item.descripcion}</p>
                          <p className="text-[9px] text-slate-500 font-bold uppercase truncate">
                            {item.cantidad} {item.unidad_medida} × ${Number(item.precio_unitario).toLocaleString('es-CL')}
                          </p>
                        </div>
                        <p className="font-black text-slate-700 text-xs shrink-0">
                          ${Number(item.subtotal).toLocaleString('es-CL')}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-6">
                    <InfoBox label="Vendedor" value={p.vendedor} />
                    <InfoBox label="Entrega" value={p.fecha_entrega} />
                    <div className="col-span-2 bg-white p-2.5 rounded-xl border border-slate-200 flex items-center gap-3">
                      <UserCheck size={16} className="text-blue-500 shrink-0"/>
                      <div className="min-w-0">
                        <p className="text-[9px] uppercase font-black text-slate-400">Recibe:</p>
                        <p className="text-xs font-bold text-slate-700 truncate">{p.quien_recibe || 'Encargado'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 w-full">
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.direccion_cliente)}`}
                      target="_blank" rel="noreferrer"
                      className="w-full bg-slate-800 text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition shadow-lg"
                    >
                      <Navigation size={18}/> Iniciar GPS
                    </a>
                    <button 
                      onClick={() => confirmarEntrega(p.id, p.folio)}
                      className="w-full bg-emerald-600 text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition shadow-lg"
                    >
                      <CheckCircle size={18}/> Confirmar Entrega
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
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-xs border border-slate-200">
            <AlertCircle size={40} className="mx-auto text-amber-500 mb-4" />
            <h2 className="text-lg font-bold text-slate-800 mb-2">Acceso Requerido</h2>
            <p className="text-slate-600 text-xs leading-relaxed">
              Ingresa el nombre de la empresa en la URL para visualizar tus pedidos.
            </p>
          </div>
        </div>
      } />
    </Routes>
  );
}

function InfoBox({ label, value }) {
  return (
    <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm min-w-0">
      <p className="text-[8px] uppercase font-black text-slate-400 mb-0.5 truncate tracking-tighter">{label}</p>
      <p className="text-[10px] font-bold text-slate-700 truncate">{value || '---'}</p>
    </div>
  );
}