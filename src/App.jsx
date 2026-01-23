import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Routes, Route, useParams } from 'react-router-dom';
import { 
  MapPin, Clock, Navigation, CheckCircle, 
  ChevronDown, ChevronUp, Package, UserCheck, 
  Search, AlertCircle, Phone, XCircle, Calendar,
  CheckCircle2, Info
} from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL, 
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// --- MODAL DE CONFIRMACIÓN ---
const CustomModal = ({ isOpen, title, message, onConfirm, onCancel, type = 'confirm' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-8 text-center">
          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${type === 'confirm' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
            {type === 'confirm' ? <CheckCircle2 size={32} /> : <Info size={32} />}
          </div>
          <h3 className="text-xl font-black text-slate-800 mb-2">{title}</h3>
          <p className="text-slate-500 text-sm leading-relaxed">{message}</p>
        </div>
        <div className="p-4 bg-slate-50 flex gap-3">
          {onCancel && (
            <button onClick={onCancel} className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-200 rounded-2xl transition">
              Cancelar
            </button>
          )}
          <button onClick={onConfirm} className={`flex-1 py-3 font-bold text-white rounded-2xl shadow-lg transition active:scale-95 ${type === 'confirm' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

function ContenedorPedidos() {
  const { nombreEmpresa } = useParams();
  const [clientesAgrupados, setClientesAgrupados] = useState([]);
  const [expandido, setExpandido] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'confirm' });

  useEffect(() => {
    if (nombreEmpresa) fetchPedidos();
  }, [nombreEmpresa]);

  const abrirModal = (title, message, onConfirm, type = 'confirm') => {
    setModal({ isOpen: true, title, message, onConfirm, type });
  };

  async function fetchPedidos() {
    setCargando(true);
    const empresaLimpia = decodeURIComponent(nombreEmpresa).trim();
    
    // Consulta Master-Detail para el proyecto de Analista Programador
    const { data, error } = await supabase
      .from('pedidos')
      .select('*, detalles_pedido!pedido_id(*)') 
      .ilike('empresa', empresaLimpia)
      .order('fecha', { ascending: false });

    if (!error) {
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
    abrirModal(
      "Entregar Folio",
      `¿Confirmar la entrega del folio #${folio}?`,
      async () => {
        const { error } = await supabase.from('pedidos').delete().eq('id', id);
        if (!error) {
          fetchPedidos();
          setModal({ ...modal, isOpen: false });
        }
      }
    );
  }

  async function confirmarTodoElCliente(pedidosCliente) {
    const ids = pedidosCliente.map(p => p.id);
    abrirModal(
      "Entrega Total",
      `¿Confirmar los ${ids.length} pedidos de este cliente?`,
      async () => {
        const { error } = await supabase.from('pedidos').delete().in('id', ids);
        if (!error) {
          setExpandido(null);
          fetchPedidos();
          setModal({ ...modal, isOpen: false });
        }
      }
    );
  }

  const esTelefonoValido = (num) => num && num.replace(/\s/g, '').length >= 8;

  if (cargando) return <div className="flex h-screen w-full items-center justify-center font-black text-indigo-600">SINCRONIZANDO RUTA...</div>;

  return (
    <div className="min-h-screen w-full bg-slate-100 font-sans text-slate-900 overflow-x-hidden">
      <CustomModal {...modal} onCancel={() => setModal({ ...modal, isOpen: false })} />

      <div className="w-full px-2 py-6 sm:px-4 md:px-10"> 
        <header className="w-full mb-8 border-b-2 border-slate-200 pb-6">
          <h1 className="text-2xl md:text-4xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
            <Package className="text-indigo-600" size={32} /> Hoja de Ruta
          </h1>
          <p className="text-slate-500 font-bold italic text-sm">{decodeURIComponent(nombreEmpresa)}</p>
        </header>

        <main className="w-full space-y-6 pb-20">
          {clientesAgrupados.map((cliente) => {
            const estaAbierto = expandido === cliente.idUnico;
            return (
              <div key={cliente.idUnico} className={`w-full bg-white rounded-[2.5rem] shadow-xl transition-all border-4 ${estaAbierto ? 'border-indigo-500' : 'border-transparent'}`}>
                
                {/* CABECERA PADRE: Ocupa el 100% sin márgenes laterales internos excesivos */}
                <div 
                  className="p-6 md:p-10 cursor-pointer border-l-[16px] border-slate-900"
                  onClick={() => setExpandido(estaAbierto ? null : cliente.idUnico)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="bg-slate-900 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">
                      Punto de Entrega
                    </span>
                    {esTelefonoValido(cliente.telefono) && (
                      <a href={`tel:${cliente.telefono}`} onClick={(e) => e.stopPropagation()} className="bg-indigo-600 text-white p-3 rounded-full shadow-lg">
                        <Phone size={20} />
                      </a>
                    )}
                  </div>
                  
                  <h2 className="text-3xl md:text-4xl font-black text-slate-800 mb-2 uppercase leading-none italic break-words">{cliente.nombre}</h2>
                  
                  <div className="flex items-start gap-2 text-slate-500 mb-8">
                    <MapPin size={22} className="text-indigo-500 shrink-0" />
                    <p className="text-base md:text-lg font-bold leading-tight break-words">{cliente.direccion}</p>
                  </div>

                  <div className="flex justify-between items-end pt-6 border-t border-slate-100">
                    <div className="flex-1">
                      {estaAbierto ? (
                        <div className="animate-in fade-in slide-in-from-left-2">
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Total de la Carga</p>
                          <p className="text-4xl font-black text-emerald-600">${cliente.totalGeneral.toLocaleString('es-CL')}</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Cantidad de Pedidos</p>
                          <p className="text-4xl font-black text-slate-800">{cliente.pedidos.length}</p>
                        </div>
                      )}
                    </div>
                    <div className="text-indigo-600 bg-indigo-50 p-3 rounded-full">
                      {estaAbierto ? <ChevronUp size={32}/> : <ChevronDown size={32}/>}
                    </div>
                  </div>
                </div>

                {/* DETALLE HIJO: Ocupa el 100% del contenedor padre */}
                {estaAbierto && (
                  <div className="bg-slate-50 p-6 md:p-10 border-t-4 border-slate-100 w-full animate-in fade-in duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
                      {cliente.pedidos.map((p) => {
                        const esFactura = !!p.rut_cliente;
                        return (
                          <div key={p.id} className="bg-white rounded-[2rem] shadow-sm border-2 border-slate-200 overflow-hidden flex flex-col">
                            {/* CABECERA HIJA: Solo color (Naranja=Factura, Azul=Boleta) para ahorrar espacio */}
                            <div className={`p-4 text-white flex justify-between items-center ${esFactura ? 'bg-orange-600' : 'bg-blue-600'}`}>
                              <span className="text-xs font-black tracking-widest uppercase"># {p.folio}</span>
                              <div className="flex gap-2 text-[10px] font-bold">
                                <span className="flex items-center gap-1"><Calendar size={12}/> {p.fecha_entrega}</span>
                                <span className="flex items-center gap-1"><Clock size={12}/> {p.hora_entrega}</span>
                              </div>
                            </div>

                            <div className="p-6 flex-1">
                              {esFactura && <div className="mb-4 text-orange-600 font-black text-xs border-b pb-2 italic uppercase">RUT: {p.rut_cliente}</div>}
                              <div className="space-y-2 mb-4">
                                {p.detalles_pedido?.map((det, idx) => (
                                  <div key={idx} className="flex justify-between text-sm text-slate-600 border-b border-slate-50 pb-1">
                                    <span className="font-bold uppercase truncate pr-4">{det.descripcion}</span>
                                    <span className="font-black shrink-0">x{det.cantidad}</span>
                                  </div>
                                ))}
                              </div>
                              {p.quien_recibe && p.quien_recibe.trim().length > 0 && (
                                <div className="mt-4 flex items-center gap-2 text-indigo-600 bg-indigo-50 p-3 rounded-2xl">
                                    <UserCheck size={18} />
                                    <p className="text-xs font-black uppercase italic truncate">Recibe: {p.quien_recibe}</p>
                                </div>
                              )}
                            </div>

                            <div className="p-6 bg-slate-50 border-t flex justify-between items-center">
                              <span className="text-2xl font-black text-emerald-600">${Number(p.total_pedido).toLocaleString('es-CL')}</span>
                              <button onClick={() => confirmarEntregaFolio(p.id, p.folio)} className="bg-emerald-500 text-white p-3 rounded-2xl shadow-lg hover:scale-105 transition">
                                <CheckCircle size={24}/>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-col gap-4 w-full">
                      <a 
  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cliente.direccion)}&travelmode=driving`}
  target="_blank" 
  rel="noreferrer"
  className="bg-slate-800 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl hover:bg-slate-900 transition uppercase tracking-widest text-sm"
>
  <Navigation size={22}/> Ir al Destino
</a>
                      
                      {cliente.pedidos.length > 1 && (
                        <button onClick={() => confirmarTodoElCliente(cliente.pedidos)} className="bg-emerald-600 text-white py-5 rounded-[1.5rem] font-black flex items-center justify-center gap-4 shadow-2xl uppercase tracking-widest text-lg hover:bg-emerald-700 transition">
                          <CheckCircle size={26}/> Confirmar Todo
                        </button>
                      )}

                      <button onClick={() => setExpandido(null)} className="bg-slate-200 text-slate-600 py-4 rounded-[1.5rem] font-black flex items-center justify-center gap-3 uppercase tracking-widest text-xs hover:bg-slate-300 transition">
                        <XCircle size={20}/> Cerrar Detalles
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
      <Route path="/" element={<div className="h-screen w-full flex items-center justify-center font-black text-slate-300 text-5xl">DELIVERY</div>} />
    </Routes>
  );
}