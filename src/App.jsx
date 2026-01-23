import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Routes, Route, useParams } from 'react-router-dom';
import { 
  MapPin, Clock, Navigation, CheckCircle, 
  ChevronDown, ChevronUp, Package, UserCheck, 
  Search, AlertCircle, Phone, FileText // FileText para indicar documento
} from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL, 
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function ContenedorPedidos() {
  const { nombreEmpresa } = useParams();
  const [clientesAgrupados, setClientesAgrupados] = useState([]);
  const [expandido, setExpandido] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (nombreEmpresa) fetchPedidos();
  }, [nombreEmpresa]);

  async function fetchPedidos() {
    setCargando(true);
    const empresaLimpia = decodeURIComponent(nombreEmpresa).trim();
    
    const { data, error } = await supabase
      .from('pedidos')
      .select('*, detalles_pedido!pedido_id(*)') 
      .ilike('empresa', empresaLimpia)
      .order('fecha', { ascending: false });

    if (error) {
      console.error("Error:", error.message);
    } else {
      // Lógica de Agrupamiento con Sumatoria de Totales
      const agrupados = data.reduce((acc, current) => {
        const rutKey = current.rut_cliente || 'SIN-RUT';
        if (!acc[rutKey]) {
          acc[rutKey] = {
            nombre: current.nombre_cliente,
            rut: current.rut_cliente,
            direccion: current.direccion_cliente,
            telefono: current.telefono,
            totalGeneral: 0, // Inicializamos el acumulador
            pedidos: []
          };
        }
        acc[rutKey].pedidos.push(current);
        acc[rutKey].totalGeneral += Number(current.total_pedido);
        return acc;
      }, {});
      
      setClientesAgrupados(Object.values(agrupados));
    }
    setCargando(false);
  }

  async function confirmarEntrega(id, folio) {
    if (window.confirm(`¿Confirmar entrega del folio #${folio}?`)) {
      const { error } = await supabase.from('pedidos').delete().eq('id', id);
      if (!error) fetchPedidos();
    }
  }

  const esTelefonoValido = (num) => num && num.replace(/\s/g, '').length >= 8;

  if (cargando) return <div className="text-center p-20 font-bold">Cargando Hoja de Ruta...</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-10 font-sans text-slate-900">
      <div className="max-w-5xl mx-auto"> 
        <header className="mb-8 border-b-2 border-slate-200 pb-6 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-slate-800 flex items-center gap-2">
              <Package className="text-blue-600" size={32} /> Central de Despacho
            </h1>
            <p className="text-slate-500 font-bold italic">{decodeURIComponent(nombreEmpresa)}</p>
          </div>
        </header>

        <main className="space-y-6 pb-20">
          {clientesAgrupados.map((cliente) => {
            const esFactura = !!cliente.rut; // Identificamos si es factura por la existencia de RUT

            return (
              <div key={cliente.rut || cliente.nombre} className="bg-white rounded-[2rem] shadow-xl border-2 border-transparent hover:border-blue-400 transition-all overflow-hidden">
                
                {/* CABECERA DINÁMICA */}
                <div 
                  className={`p-6 md:p-8 cursor-pointer transition-colors ${esFactura ? 'border-l-[12px] border-orange-500' : 'border-l-[12px] border-blue-500'}`}
                  onClick={() => setExpandido(expandido === cliente.rut ? null : cliente.rut)}
                >
                  <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
                    <div className="flex gap-2 items-center">
                      {/* Badge de tipo de documento */}
                      <span className={`flex items-center gap-1 text-[10px] font-black px-3 py-1 rounded-full text-white uppercase tracking-tighter shadow-sm ${esFactura ? 'bg-orange-500' : 'bg-blue-500'}`}>
                        <FileText size={12}/> {esFactura ? 'Factura' : 'Boleta / Vale'}
                      </span>
                      {/* RUT Condicional */}
                      {esFactura && (
                        <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-3 py-1 rounded-full">
                          RUT: {cliente.rut}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {esTelefonoValido(cliente.telefono) && (
                        <a href={`tel:${cliente.telefono}`} onClick={(e) => e.stopPropagation()} className="bg-emerald-500 text-white p-2 rounded-full shadow-lg">
                          <Phone size={18} />
                        </a>
                      )}
                    </div>
                  </div>
                  
                  <h2 className="text-2xl font-black text-slate-800 mb-2 uppercase leading-none">
                    {cliente.nombre}
                  </h2>
                  
                  <div className="flex items-start gap-2 text-slate-500 mb-4">
                    <MapPin size={18} className="text-red-500 shrink-0" />
                    <p className="text-sm font-bold break-words">{cliente.direccion}</p>
                  </div>

                  {/* Resumen de totales del cliente */}
                  <div className="flex justify-between items-end pt-4 border-t border-slate-100">
                    <div>
                      <p className="text-[10px] text-slate-400 font-black uppercase">Total Neto de Carga ({cliente.pedidos.length})</p>
                      <p className="text-3xl font-black text-slate-800">
                        ${cliente.totalGeneral.toLocaleString('es-CL')}
                      </p>
                    </div>
                    <div className="text-slate-400 flex flex-col items-center">
                      <p className="text-[10px] font-black uppercase mb-1">{expandido === cliente.rut ? 'Cerrar' : 'Ver Detalles'}</p>
                      {expandido === cliente.rut ? <ChevronUp size={24}/> : <ChevronDown size={24}/>}
                    </div>
                  </div>
                </div>

                {/* DETALLE DE FOLIOS INDIVIDUALES */}
                {expandido === cliente.rut && (
                  <div className="bg-slate-50 p-4 md:p-8 border-t-2 border-slate-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {cliente.pedidos.map((p) => (
                        <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                          <div className="p-3 bg-slate-800 text-white flex justify-between items-center">
                            <span className="text-xs font-black tracking-widest">FOLIO #{p.folio}</span>
                            <span className="text-[10px] font-bold opacity-70 flex items-center gap-1"><Clock size={12}/> {p.hora_entrega}</span>
                          </div>
                          <div className="p-4 flex-1">
                            {p.detalles_pedido?.map((det, idx) => (
                              <div key={idx} className="flex justify-between text-xs mb-1 text-slate-600 border-b border-slate-50 pb-1">
                                <span className="font-medium truncate pr-4">{det.descripcion}</span>
                                <span className="font-black shrink-0">x{det.cantidad}</span>
                              </div>
                            ))}
                          </div>
                          <div className="p-4 bg-slate-50 border-t flex justify-between items-center">
                            <span className="text-lg font-black text-emerald-600">${Number(p.total_pedido).toLocaleString('es-CL')}</span>
                            <button onClick={() => confirmarEntrega(p.id, p.folio)} className="bg-emerald-600 text-white p-2 rounded-xl hover:bg-emerald-700 transition active:scale-95 shadow-md">
                              <CheckCircle size={20}/>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cliente.direccion)}`} target="_blank" rel="noreferrer" className="mt-6 w-full bg-slate-800 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl hover:bg-slate-900 transition uppercase tracking-widest text-sm">
                      <Navigation size={22}/> Iniciar GPS hacia {cliente.nombre}
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/:nombreEmpresa" element={<ContenedorPedidos />} />
      <Route path="/" element={<div className="p-20 text-center font-black text-slate-300 text-4xl">SISTEMA POS DELIVERY</div>} />
    </Routes>
  );
}