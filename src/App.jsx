import React, { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Routes, Route } from 'react-router-dom';
import { 
  MapPin, Clock, Navigation, CheckCircle, 
  ChevronDown, ChevronUp, Package, UserCheck, 
  Search, AlertCircle, Phone, XCircle, Calendar,
  Camera, ArrowLeft, Image as ImageIcon, Globe, 
  CheckCircle2, Info, RotateCcw
} from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL, 
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const formatearFechaChile = (fechaStr) => {
  if (!fechaStr) return '--/--/----';
  const [year, month, day] = fechaStr.split('-');
  return `${day}-${month}-${year}`;
};

const CustomModal = ({ isOpen, title, message, onConfirm, onCancel, type = 'confirm' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="p-8 text-center">
          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${type === 'confirm' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
            {type === 'confirm' ? <CheckCircle2 size={32} /> : <Info size={32} />}
          </div>
          <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tighter">{title}</h3>
          <p className="text-slate-500 text-sm leading-relaxed">{message}</p>
        </div>
        <div className="p-4 bg-slate-50 flex gap-3">
          {onCancel && <button onClick={onCancel} className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-200 rounded-2xl transition">Cancelar</button>}
          <button onClick={onConfirm} className={`flex-1 py-3 font-bold text-white rounded-2xl shadow-lg transition active:scale-95 ${type === 'confirm' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}>Confirmar</button>
        </div>
      </div>
    </div>
  );
};

function ContenedorPedidos() {
  const [clientesAgrupados, setClientesAgrupados] = useState([]);
  const [expandido, setExpandido] = useState(null);
  const [verMapa, setVerMapa] = useState(null);
  const [posicionActual, setPosicionActual] = useState(null);
  const [cargando, setCargando] = useState(true);
  
  const [pedidoEnProceso, setPedidoEnProceso] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'confirm' });
  
  const fileInputRef = useRef(null);

  useEffect(() => { fetchPedidos(); }, []);

  async function fetchPedidos() {
    setCargando(true);
    const { data, error } = await supabase
      .from('pedidos')
      .select('*, detalles_pedido!pedido_id(*)') 
      .eq('estado_entregado', false)
      .order('fecha', { ascending: true })
      .order('hora_entrega', { ascending: true });

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
            pedidos: [],
            prioridad: new Date(`${current.fecha_entrega}T${current.hora_entrega || '00:00'}`)
          };
        }
        acc[clienteID].pedidos.push(current);
        acc[clienteID].totalGeneral += Number(current.total_pedido);
        return acc;
      }, {});
      setClientesAgrupados(Object.values(agrupados).sort((a, b) => a.prioridad - b.prioridad));
    }
    setCargando(false);
  }

  const activarNavegacion = (clienteId) => {
    if (!navigator.geolocation) return alert("Tu navegador no soporta GPS");

    const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPosicionActual({ lat: position.coords.latitude, lng: position.coords.longitude });
        setVerMapa(clienteId);
      },
      (err) => {
        let msg = "No pudimos acceder al GPS.";
        if (err.code === 1) msg = "Por favor, autoriza el acceso a la ubicación en los ajustes de tu iPhone/Android.";
        alert(msg);
      },
      options
    );
  };

  const iniciarCaptura = (pedido) => {
    setPedidoEnProceso(pedido);
    if (fileInputRef.current) fileInputRef.current.value = ""; // Limpiar para permitir reintento
    setTimeout(() => fileInputRef.current.click(), 100);
  };

  const manejarFoto = (e) => {
    const archivo = e.target.files[0];
    if (archivo) {
      const reader = new FileReader();
      reader.onloadend = () => setFotoPreview(reader.result);
      reader.readAsDataURL(archivo);
    }
  };

  const reintentarFoto = () => {
    setFotoPreview(null);
    setTimeout(() => fileInputRef.current.click(), 100);
  };

  const cancelarTodo = () => {
    setFotoPreview(null);
    setPedidoEnProceso(null);
  };

  const confirmarEntregaFinal = async () => {
    setSubiendo(true);
    try {
      const base64Data = fotoPreview.split(',')[1];
      const blob = await fetch(`data:image/jpeg;base64,${base64Data}`).then(res => res.blob());
      const nombre = `entrega_${pedidoEnProceso.folio}_${Date.now()}.jpg`;
      const { error: storageError } = await supabase.storage.from('evidencias').upload(`public/${nombre}`, blob);
      
      if (storageError) throw storageError;

      const { data: urlData } = supabase.storage.from('evidencias').getPublicUrl(`public/${nombre}`);
      
      const { error: dbError } = await supabase.from('pedidos')
        .update({ estado_entregado: true, url_foto: urlData.publicUrl })
        .eq('id', pedidoEnProceso.id);

      if (!dbError) {
        cancelarTodo();
        fetchPedidos();
      }
    } catch (err) { alert("Error al procesar: " + err.message); }
    setSubiendo(false);
  };

  if (cargando) return <div className="h-screen w-full flex items-center justify-center font-black text-indigo-600 animate-pulse text-2xl">SINCRONIZANDO...</div>;

  if (fotoPreview) {
    return (
      <div className="fixed inset-0 z-[250] bg-slate-900 flex items-center justify-center p-2 sm:p-4">
        <div className="w-full max-w-sm bg-white rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
          <div className="p-4 border-b flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2 text-indigo-600">
              <Camera size={18} />
              <span className="font-black text-xs uppercase tracking-widest">Validar Entrega</span>
            </div>
            <XCircle onClick={cancelarTodo} className="text-slate-300 cursor-pointer" size={24} />
          </div>
          
          <div className="bg-black flex-shrink-0 flex items-center justify-center overflow-hidden">
            <img src={fotoPreview} className="max-h-[30vh] w-full object-contain" alt="Preview" />
          </div>

          <div className="p-6 overflow-y-auto">
            <h4 className="text-xl font-black text-slate-800 text-center mb-6 uppercase">Folio #{pedidoEnProceso?.folio}</h4>
            <div className="flex flex-col gap-3">
              <button disabled={subiendo} onClick={confirmarEntregaFinal} className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-base flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all">
                {subiendo ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : <><CheckCircle size={22} /> Confirmar Entrega</>}
              </button>
              
              <button disabled={subiendo} onClick={reintentarFoto} className="w-full bg-slate-100 text-indigo-600 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all border border-indigo-50">
                <RotateCcw size={18} /> Tomar Nueva Foto
              </button>

              <button disabled={subiendo} onClick={cancelarTodo} className="w-full bg-white text-slate-400 py-2 rounded-2xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all">
                Cancelar y Volver
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-100 font-sans text-slate-900 overflow-x-hidden">
      <CustomModal {...modal} onCancel={() => setModal({ ...modal, isOpen: false })} />
      <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={manejarFoto} />

      <div className="w-full px-2 py-6 sm:px-4 md:px-10"> 
        <header className="w-full mb-8 border-b-2 border-slate-200 pb-6 flex justify-between items-center px-2">
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
              <Package className="text-indigo-600 shrink-0" size={32} /> Hoja de Ruta
            </h1>
            <p className="text-slate-500 font-bold italic text-sm">Logística en tiempo real</p>
          </div>
        </header>

        <main className="w-full space-y-6 pb-20 px-2">
          {clientesAgrupados.map((cliente) => {
            const estaAbierto = expandido === cliente.idUnico;
            const mapaActivo = verMapa === cliente.idUnico;

            return (
              <div key={cliente.idUnico} className={`w-full bg-white rounded-[2.5rem] shadow-xl border-4 transition-all ${estaAbierto ? 'border-indigo-500' : 'border-transparent'}`}>
                
                <div className="p-6 md:p-10 cursor-pointer border-l-[16px] border-slate-900" onClick={() => { setExpandido(estaAbierto ? null : cliente.idUnico); setVerMapa(null); }}>
                  <div className="flex justify-between items-start mb-4">
                    <span className="bg-slate-900 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">Punto de Entrega</span>
                    {esTelefonoValido(cliente.telefono) && <a href={`tel:${cliente.telefono}`} onClick={(e) => e.stopPropagation()} className="bg-indigo-600 text-white p-3 rounded-full shadow-lg"><Phone size={20} /></a>}
                  </div>
                  <h2 className="text-3xl md:text-5xl font-black text-slate-800 mb-2 uppercase leading-none break-words italic">{cliente.nombre}</h2>
                  <div className="flex items-start gap-2 text-slate-500 mb-8 font-bold"><MapPin size={22} className="text-indigo-500 shrink-0" /><p className="text-base md:text-lg leading-tight break-words">{cliente.direccion}</p></div>

                  <div className="flex justify-between items-end pt-6 border-t border-slate-100 gap-4">
                    <div className="flex-1">
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{estaAbierto ? 'Total Acumulado' : 'Próxima: ' + cliente.pedidos[0].hora_entrega}</p>
                      <p className="text-4xl font-black text-slate-800">{estaAbierto ? `$${cliente.totalGeneral.toLocaleString('es-CL')}` : cliente.pedidos.length + ' Pedidos'}</p>
                    </div>
                    <div className="text-indigo-600 bg-indigo-50 p-3 rounded-full">{estaAbierto ? <ChevronUp size={32}/> : <ChevronDown size={32}/>}</div>
                  </div>
                </div>

                {estaAbierto && (
                  <div className="bg-slate-50 p-4 md:p-10 border-t-4 border-slate-100 w-full animate-in fade-in">
                    {mapaActivo && posicionActual && (
                      <div className="w-full h-80 mb-10 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-xl">
                        <iframe width="100%" height="100%" frameBorder="0" style={{ border: 0 }} src={`https://www.google.com/maps/dir/?api=1&destination=$...{posicionActual.lat},${posicionActual.lng}&daddr=${encodeURIComponent(cliente.direccion)}&t=&z=15&ie=UTF8&iwloc=&output=embed`} allowFullScreen></iframe>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
                      {cliente.pedidos.map((p) => {
                        const esFactura = !!p.rut_cliente;
                        return (
                          <div key={p.id} className="bg-white rounded-[2rem] shadow-sm border-2 border-slate-200 overflow-hidden flex flex-col transition-all hover:shadow-md">
                            <div className={`p-4 text-white flex justify-between items-center ${esFactura ? 'bg-orange-600' : 'bg-blue-600'}`}>
                              <span className="text-xs font-black tracking-widest uppercase"># {p.folio}</span>
                              <div className="flex gap-2 text-[10px] font-bold"><span>{formatearFechaChile(p.fecha_entrega)}</span><span>{p.hora_entrega}</span></div>
                            </div>
                            <div className="p-6 flex-1">
                              {esFactura && <div className="mb-4 text-orange-600 font-black text-[10px] border-b pb-1 uppercase italic">RUT: {p.rut_cliente}</div>}
                              <div className="space-y-2 mb-4">
                                {p.detalles_pedido?.map((det, idx) => (
                                  <div key={idx} className="flex justify-between text-xs text-slate-600 border-b border-slate-50 pb-1">
                                    <span className="font-bold uppercase truncate pr-4">{det.descripcion}</span><span className="font-black shrink-0">x{det.cantidad}</span>
                                  </div>
                                ))}
                              </div>
                              {p.quien_recibe && p.quien_recibe.trim() !== "" && <div className="mt-4 flex items-center gap-2 text-indigo-600 bg-indigo-50 p-3 rounded-xl"><UserCheck size={16}/><p className="text-[10px] font-black uppercase truncate italic">Recibe: {p.quien_recibe}</p></div>}
                            </div>
                            <div className="p-6 bg-slate-50 border-t flex justify-between items-center">
                              <span className="text-2xl font-black text-emerald-600">${Number(p.total_pedido).toLocaleString('es-CL')}</span>
                              <button onClick={() => iniciarCaptura(p)} className="bg-emerald-500 text-white p-3 rounded-2xl shadow-lg hover:scale-105 active:scale-90 transition"><Camera size={24}/></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-col gap-6 w-full">
                      <button onClick={() => activarNavegacion(cliente.idUnico)} className="bg-slate-800 text-white py-5 rounded-[1.5rem] font-black flex items-center justify-center gap-4 shadow-2xl uppercase tracking-widest text-lg hover:bg-slate-900 transition"><Navigation size={26}/> {mapaActivo ? "Actualizar Mi Ruta" : "Iniciar GPS (Ver Ruta)"}</button>
                      
                      {cliente.pedidos.length > 1 && (
                        <button onClick={() => iniciarCaptura(cliente.pedidos[0])} className="bg-emerald-600 text-white py-5 rounded-[1.5rem] font-black flex items-center justify-center gap-4 shadow-2xl uppercase tracking-widest text-lg active:scale-95 transition">
                          <CheckCircle size={26}/> Confirmar Entrega Total
                        </button>
                      )}

                      <button onClick={() => setExpandido(null)} className="bg-slate-200 text-slate-600 py-4 rounded-[1.5rem] font-black flex items-center justify-center gap-3 uppercase tracking-widest text-xs">
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
      <Route path="/" element={<ContenedorPedidos />} />
      <Route path="*" element={<div className="h-screen w-full flex items-center justify-center font-black text-slate-300 text-5xl italic uppercase tracking-tighter">POS DELIVERY</div>} />
    </Routes>
  );
}

const esTelefonoValido = (num) => num && num.replace(/\s/g, '').length >= 8;