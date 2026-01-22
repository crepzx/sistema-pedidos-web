import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useParams } from 'react-router-dom'; // Necesario para capturar la empresa de la URL
import { MapPin, Clock, Navigation, CheckCircle, ChevronDown, ChevronUp, Package, UserCheck } from 'lucide-react';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

export default function App() {
  const { nombreEmpresa } = useParams(); // Ahora nombreEmpresa sí existe
  const [pedidos, setPedidos] = useState([]);
  const [expandido, setExpandido] = useState(null);

  useEffect(() => {
    if (nombreEmpresa) {
      fetchPedidos();
    }
  }, [nombreEmpresa]);

async function fetchPedidos() {
  // .trim() elimina cualquier espacio accidental al inicio o final de la URL
  const empresaLimpia = decodeURIComponent(nombreEmpresa).trim();
  
  console.log("Buscando empresa exacta:", `"${empresaLimpia}"`); // Esto aparecerá en tu F12

  const { data, error } = await supabase
    .from('pedidos')
    .select('*, detalles_pedido(*)') 
    .ilike('empresa', empresaLimpia) 
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error("Error de Supabase:", error);
  } else {
    console.log("Resultados encontrados:", data);
    setPedidos(data || []);
  }
}

  async function confirmarEntrega(id, folio) {
    if (window.confirm(`¿Confirmar entrega del pedido #${folio}?\n\nSe eliminará del sistema.`)) {
      const { error } = await supabase.from('pedidos').delete().eq('id', id);
      if (!error) {
        alert("Pedido entregado correctamente.");
        fetchPedidos();
        setExpandido(null);
      } else {
        alert("Error al procesar entrega.");
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <header className="max-w-2xl mx-auto mb-8">
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Rutas de Entrega</h1>
        <p className="text-slate-500 font-medium italic">Empresa: {decodeURIComponent(nombreEmpresa || '')}</p>
      </header>

      <main className="max-w-2xl mx-auto space-y-4">
        {pedidos.length === 0 && (
          <div className="text-center py-20 text-slate-400">
            <Package size={48} className="mx-auto mb-4 opacity-20" />
            <p>No hay pedidos pendientes para esta empresa.</p>
          </div>
        )}

        {pedidos.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
            {/* CABECERA DE TARJETA */}
            <div className="p-5 cursor-pointer" onClick={() => setExpandido(expandido === p.id ? null : p.id)}>
              <div className="flex justify-between items-start mb-3">
                <span className="bg-blue-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full italic">#{p.folio}</span>
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
                <span className="text-2xl font-black text-emerald-600">${Number(p.total || p.total_pedido).toLocaleString('es-CL')}</span>
                <div className="bg-slate-100 p-2 rounded-full text-slate-400">
                  {expandido === p.id ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                </div>
              </div>
            </div>

            {/* DETALLE EXPANDIDO */}
            {expandido === p.id && (
              <div className="bg-slate-50 p-5 border-t">
                <h4 className="text-xs font-bold uppercase text-slate-400 mb-3 tracking-widest">Detalle de Productos</h4>
                
                <div className="space-y-2 mb-6">
                  {/* Validamos que detalles_pedido exista, sino mostramos el producto único (C# flat) */}
                  {p.detalles_pedido && p.detalles_pedido.length > 0 ? (
                    p.detalles_pedido.map((item, index) => (
                      <div key={index} className="flex justify-between bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{item.descripcion || item.producto}</p>
                          <p className="text-[10px] text-slate-500 uppercase font-bold">
                            {item.cantidad} {item.unidad_medida} x ${Number(item.precio_unitario || item.precio).toLocaleString('es-CL')}
                          </p>
                        </div>
                        <p className="font-black text-slate-700">${Number(item.subtotal || item.total).toLocaleString('es-CL')}</p>
                      </div>
                    ))
                  ) : (
                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                      <p className="font-bold text-slate-800">{p.producto}</p>
                      <p className="text-xs text-slate-500">{p.cantidad} {p.unidad_medida}</p>
                    </div>
                  )}
                </div>

                {/* Información de entrega */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <InfoBox label="Vendedor" value={p.vendedor} />
                  <InfoBox label="Fecha" value={p.fecha_entrega} />
                  <div className="col-span-2 bg-white p-3 rounded-lg border border-slate-200 flex items-center gap-2">
                    <UserCheck size={16} className="text-blue-500"/>
                    <div>
                      <p className="text-[10px] uppercase font-black text-slate-400">Recibe:</p>
                      <p className="text-sm font-bold text-slate-700">{p.quien_recibe || 'Cualquier persona'}</p>
                    </div>
                  </div>
                </div>

                {/* BOTONES DE ACCIÓN */}
                <div className="flex flex-col gap-3">
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.direccion_cliente)}`}
                    target="_blank" 
                    rel="noreferrer"
                    className="bg-slate-800 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-slate-700 transition active:scale-95"
                  >
                    <Navigation size={20}/> Iniciar Navegación GPS
                  </a>
                  <button 
                    onClick={() => confirmarEntrega(p.id, p.folio)}
                    className="bg-emerald-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-emerald-700 transition active:scale-95"
                  >
                    <CheckCircle size={20}/> Confirmar Entrega
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

function InfoBox({ label, value }) {
  return (
    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
      <p className="text-[10px] uppercase font-black text-slate-400 mb-0.5">{label}</p>
      <p className="text-xs font-bold text-slate-700">{value || '---'}</p>
    </div>
  );
}