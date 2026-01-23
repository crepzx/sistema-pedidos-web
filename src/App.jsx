import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Routes, Route, useParams } from 'react-router-dom';
import { 
  MapPin, Clock, Navigation, CheckCircle, 
  ChevronDown, ChevronUp, Package, UserCheck, 
  Search, AlertCircle, Phone, FileText, XCircle, Calendar
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
      const agrupados = data.reduce((acc, current) => {
        const clienteID = current.rut_cliente || current.nombre_cliente; 
        if (!acc[clienteID]) {
          acc[clienteID] = {
            idUnico: clienteID,
            nombre: current.nombre_cliente,
            rut: current.rut_cliente,
            direccion: current.direccion_cliente,
            telefono: current.telefono,
            totalGeneral: 0,
            pedidos: []
          };
        }
        acc[clienteID].pedidos.push(current);
        acc[clienteID].totalGeneral += Number(current.total_pedido);
        return acc;
      }, {});
      
      setClientesAgrupados(Object.values(agrupados));
    }
    setCargando(false);
  }

  async function confirmarEntregaFolio(id, folio) {
    if (window.confirm(`¿Confirmar entrega del folio #${folio}?`)) {
      const { error } = await supabase.from('pedidos').delete().eq('id', id);
      if (!error) fetchPedidos();
    }
  }

  async function confirmarTodoElCliente(pedidosCliente) {
    const ids = pedidosCliente.map(p => p.id);
    if (window.confirm(`¿Confirmar entrega de los ${ids.length} pedidos de este cliente?`)) {
      const { error } = await supabase.from('pedidos').delete().in('id', ids);
      if (!error) {
        setExpandido(null);
        fetchPedidos();
      }
    }
  }

  const esTelefonoValido = (num) => num && num.replace(/\s/g, '').length >= 8;

  if (cargando) return <div className="text-center p-20 font-black">Cargando...</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-10 font-sans text-slate-900">
      <div className="max-w-5xl mx-auto"> 
        <header className="mb-8 border-b-2 border-slate-200 pb-6">
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-2 uppercase tracking-tighter">
            <Package className="text-indigo-600" size={32} /> Hoja de Ruta
          </h1>
          <p className="text-slate-500 font-bold italic text-sm">{decodeURIComponent(nombreEmpresa)}</p>
        </header>

        <main className="space-y-6 pb-20">
          {clientesAgrupados.map((cliente) => {
            const estaAbierto = expandido === cliente.idUnico;

            return (
              <div key={cliente.idUnico} className={`w-full bg-white rounded-[2rem] shadow-xl border-2 transition-all overflow-hidden ${estaAbierto ? 'border-indigo-500' : 'border-transparent'}`}>
                
                {/* CARD PADRE: Estilo Neutro/Logístico */}
                <div 
                  className="p-6 md:p-8 cursor-pointer border-l-[12px] border-slate-800"
                  onClick={() => setExpandido(estaAbierto ? null : cliente.idUnico)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-2 items-center">
                      <span className="bg-slate-800 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                        Punto de Entrega
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {esTelefonoValido(cliente.telefono) && (
                        <a href={`tel:${cliente.telefono}`} onClick={(e) => e.stopPropagation()} className="bg-indigo-600 text-white p-2 rounded-full shadow-lg">
                          <Phone size={18} />
                        </a>
                      )}
                    </div>
                  </div>
                  
                  <h2 className="text-2xl font-black text-slate-800 mb-2 uppercase leading-none italic">{cliente.nombre}</h2>
                  
                  <div className="flex items-start gap-2 text-slate-500 mb-6">
                    <MapPin size={18} className="text-indigo-500 shrink-0" />
                    <p className="text-sm font-bold leading-tight">{cliente.direccion}</p>
                  </div>

                  <div className="flex justify-between items-end pt-4 border-t border-slate-100">
                    <div>
                      {estaAbierto ? (
                        <>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Cobro Total Sugerido</p>
                          <p className="text-3xl font-black text-emerald-600">${cliente.totalGeneral.toLocaleString('es-CL')}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Pedidos Pendientes</p>
                          <p className="text-3xl font-black text-slate-800">{cliente.pedidos.length}</p>
                        </>
                      )}
                    </div>
                    <div className="flex flex-col items-center text-indigo-600">
                      {estaAbierto ? <ChevronUp size={28}/> : <ChevronDown size={28}/>}
                    </div>
                  </div>
                </div>

                {/* DETALLE EXPANDIDO: Aquí se distinguen Boleta y Factura */}
                {estaAbierto && (
                  <div className="bg-slate-50 p-4 md:p-8 border-t-2 border-slate-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                      {cliente.pedidos.map((p) => {
                        const esFactura = !!p.rut_cliente; // Distinción por pedido individual
                        
                        return (
                          <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                            {/* Header del pedido con color según documento */}
                            <div className={`p-3 text-white flex justify-between items-center ${esFactura ? 'bg-orange-600' : 'bg-blue-600'}`}>
                              <div className="flex items-center gap-2">
                                <FileText size={14}/>
                                <span className="text-[10px] font-black uppercase tracking-widest">
                                  {esFactura ? 'Factura' : 'Boleta'} #{p.folio}
                                </span>
                              </div>
                              <span className="text-[9px] font-bold opacity-80 flex items-center gap-1"><Clock size={12}/> {p.hora_entrega}</span>
                            </div>

                            <div className="p-4 flex-1">
                              <div className="mb-3 flex items-center gap-2 text-slate-400 border-b pb-2">
                                <Calendar size={12}/>
                                <span className="text-[10px] font-bold">Entrega: {p.fecha_entrega}</span>
                                {esFactura && <span className="ml-auto text-[9px] font-black text-orange-600">RUT: {p.rut_cliente}</span>}
                              </div>

                              {p.detalles_pedido?.map((det, idx) => (
                                <div key={idx} className="flex justify-between text-xs mb-1 text-slate-600 border-b border-slate-50 pb-1">
                                  <span className="font-bold truncate pr-4 uppercase">{det.descripcion}</span>
                                  <span className="font-black shrink-0">x{det.cantidad}</span>
                                </div>
                              ))}

                              {p.quien_recibe && (
                                <div className="mt-3 flex items-center gap-2 text-indigo-600 bg-indigo-50 p-2 rounded-lg">
                                    <UserCheck size={14} />
                                    <p className="text-[10px] font-black uppercase truncate">Recibe: {p.quien_recibe}</p>
                                </div>
                              )}
                            </div>

                            <div className="p-4 bg-slate-50 border-t flex justify-between items-center">
                              <span className="text-lg font-black text-emerald-600">${Number(p.total_pedido).toLocaleString('es-CL')}</span>
                              <button onClick={() => confirmarEntregaFolio(p.id, p.folio)} className="bg-emerald-500 text-white p-2 rounded-xl hover:bg-emerald-600 transition shadow-md">
                                <CheckCircle size={20}/>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-col gap-3 max-w-2xl mx-auto">
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cliente.direccion)}`} target="_blank" rel="noreferrer" className="bg-slate-800 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl uppercase tracking-widest text-sm">
                        <Navigation size={22}/> Navegar
                      </a>
                      <button onClick={() => confirmarTodoElCliente(cliente.pedidos)} className="bg-emerald-600 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl uppercase tracking-widest text-sm">
                        <CheckCircle size={22}/> Confirmar Entrega Total
                      </button>
                      <button onClick={() => setExpandido(null)} className="bg-slate-200 text-slate-600 py-3 rounded-2xl font-black flex items-center justify-center gap-3 uppercase tracking-widest text-xs">
                        <XCircle size={18}/> Cerrar Detalles
                      </button>
                    </div>
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