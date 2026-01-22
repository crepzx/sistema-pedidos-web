import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { MapPin, Clock, Navigation, CheckCircle, ChevronDown, ChevronUp, Package } from 'lucide-react';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

export default function App() {
  const [pedidos, setPedidos] = useState([]);
  const [expandido, setExpandido] = useState(null);

  useEffect(() => {
    fetchPedidos();
  }, []);

  async function fetchPedidos() {
    const { data } = await supabase.from('pedidos').select('*').order('created_at', { ascending: false });
    setPedidos(data || []);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <header className="max-w-2xl mx-auto mb-8">
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Rutas de Entrega</h1>
        <p className="text-slate-500 font-medium">Hoy: {new Date().toLocaleDateString('es-CL')}</p>
      </header>

      <main className="max-w-2xl mx-auto space-y-4">
        {pedidos.length === 0 && (
          <div className="text-center py-20 text-slate-400">
            <Package size={48} className="mx-auto mb-4 opacity-20" />
            <p>No hay pedidos pendientes para entrega</p>
          </div>
        )}

        {pedidos.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden transition-all duration-300">
            {/* CABECERA DE LA TARJETA */}
            <div 
              className="p-5 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setExpandido(expandido === p.id ? null : p.id)}
            >
              <div className="flex justify-between items-start mb-3">
                <span className="bg-blue-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase">
                  #{p.folio}
                </span>
                <span className="text-slate-400 text-xs font-bold flex items-center gap-1">
                  <Clock size={14}/> {p.hora_entrega || 'Sin hora'}
                </span>
              </div>
              
              <h2 className="text-xl font-bold text-slate-800 mb-1">{p.nombre_cliente}</h2>
              <div className="flex items-start gap-1.5 text-slate-500">
                <MapPin size={18} className="text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm font-medium leading-tight">{p.direccion_cliente}</p>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                <span className="text-2xl font-black text-emerald-600">
                  ${Number(p.total).toLocaleString('es-CL')}
                </span>
                <div className="bg-slate-100 p-2 rounded-full text-slate-400">
                  {expandido === p.id ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                </div>
              </div>
            </div>

            {/* DETALLES EXPANDIDOS */}
            {expandido === p.id && (
              <div className="bg-slate-50 p-5 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <DetailBox label="Producto" value={`${p.producto} (x${p.cantidad})`} />
                  <DetailBox label="Vendedor" value={p.vendedor} />
                  <DetailBox label="Forma de Pago" value={p.forma_pago} />
                  <DetailBox label="Documento" value={p.es_factura ? "Factura" : "Boleta/Vale"} />
                </div>

                {p.comentario && (
                  <div className="mb-6 p-3 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg">
                    <p className="text-[10px] uppercase font-bold text-amber-600 mb-1">Comentario</p>
                    <p className="text-sm text-amber-800 italic">"{p.comentario}"</p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.direccion_cliente)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 bg-slate-800 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-slate-700 active:scale-95 transition"
                  >
                    <Navigation size={20}/> Iniciar GPS
                  </a>
                  <button className="flex-1 bg-emerald-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-emerald-700 active:scale-95 transition">
                    <CheckCircle size={20}/> Entregado
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}

// Sub-componente para limpiar el código
function DetailBox({ label, value }) {
  return (
    <div>
      <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-slate-700">{value || '---'}</p>
    </div>
  );
}