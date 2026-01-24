import React, { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Routes, Route } from 'react-router-dom';
import { 
  MapPin, Clock, Navigation, CheckCircle, 
  ChevronDown, ChevronUp, Package, UserCheck, 
  Search, AlertCircle, Phone, XCircle, Calendar,
  Camera, ArrowLeft, Image as ImageIcon, Globe
} from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL, 
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// --- UTILIDAD: Formato de Fecha Chileno ---
const formatearFechaChile = (fechaStr) => {
  if (!fechaStr) return '--/--/----';
  const [year, month, day] = fechaStr.split('-');
  return `${day}-${month}-${year}`;
};

function ContenedorPedidos() {
  const [clientesAgrupados, setClientesAgrupados] = useState([]);
  const [expandido, setExpandido] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [verMapa, setVerMapa] = useState(null);
  const [posicionActual, setPosicionActual] = useState(null);

  // Estados para la verificación por foto
  const [pedidoEnProceso, setPedidoEnProceso] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const fileInputRef = useRef(null);
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    fetchPedidos();
  }, []);

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
      
      const listaOrdenada = Object.values(agrupados).sort((a, b) => a.prioridad - b.prioridad);
      setClientesAgrupados(listaOrdenada);
    }
    setCargando(false);
  }

  // --- LÓGICA DE NAVEGACIÓN GPS INTERNA ---
  const activarNavegacion = (clienteId) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPosicionActual({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setVerMapa(clienteId); 
        },
        () => {
          alert("Error: Por favor activa el GPS de tu celular para trazar la ruta en el mapa.");
        }
      );
    } else {
      alert("Tu navegador no soporta geolocalización.");
    }
  };

  async function subirFoto(archivoBase64, folio) {
    try {
      const base64Data = archivoBase64.split(',')[1];
      const blob = await fetch(`data:image/jpeg;base64,${base64Data}`).then(res => res.blob());
      const nombreArchivo = `entrega_${folio}_${Date.now()}.jpg`;
      const rutaArchivo = `public/${nombreArchivo}`;

      const { data, error } = await supabase.storage
        .from('evidencias')
        .upload(rutaArchivo, blob, { contentType: 'image/jpeg' });

      if (error) throw error;
      const { data: urlData } = supabase.storage.from('evidencias').getPublicUrl(rutaArchivo);
      return urlData.publicUrl;
    } catch (err) {
      console.error("Error al subir foto:", err.message);
      return null;
    }
  }

  const iniciarCaptura = (pedido) => {
    setPedidoEnProceso(pedido);
    fileInputRef.current.click();
  };

  const manejarFoto = (e) => {
    const archivo = e.target.files[0];
    if (archivo) {
      const reader = new FileReader();
      reader.onloadend = () => setFotoPreview(reader.result);
      reader.readAsDataURL(archivo);
    }
  };

  const cancelarCaptura = () => {
    setFotoPreview(null);
    setPedidoEnProceso(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const confirmarEntregaFinal = async () => {
    if (!pedidoEnProceso || !fotoPreview) return;
    setSubiendo(true);
    const urlFoto = await subirFoto(fotoPreview, pedidoEnProceso.folio);

    if (!urlFoto) {
      alert("Error al subir la evidencia. Intente nuevamente.");
      setSubiendo(false);
      return;
    }

    const { error } = await supabase
      .from('pedidos')
      .update({ estado_entregado: true, url_foto: urlFoto })
      .eq('id', pedidoEnProceso.id);

    if (!error) {
      alert(`Folio #${pedidoEnProceso.folio} entregado correctamente.`);
      cancelarCaptura();
      fetchPedidos();
    } else {
      alert("Error al actualizar estado: " + error.message);
    }
    setSubiendo(false);
  };

  if (cargando) return <div className="flex h-screen w-full items-center justify-center font-black text-indigo-600">CARGANDO RUTA...</div>;

  if (fotoPreview) {
    return (
      <div className="fixed inset-0 z-[200] bg-slate-900 overflow-y-auto flex items-start sm:items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-[3rem] overflow-hidden shadow-2xl my-auto border-4 border-white/20">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Camera className="text-indigo-600" size={20} />
              <h3 className="font-black text-slate-800 text-sm uppercase tracking-tighter">Evidencia Capturada</h3>
            </div>
            <XCircle onClick={cancelarCaptura} className="text-slate-400 hover:text-red-500 transition cursor-pointer" size={28} />
          </div>
          <div className="w-full bg-black flex items-center justify-center border-y-8 border-white">
            <img src={fotoPreview} alt="Evidencia" className="w-full max-h-[40vh] object-contain shadow-inner" />
          </div>
          <div className="p-8 md:p-10">
            <div className="text-center mb-8">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">Confirmación Final</p>
              <h4 className="text-2xl font-black text-slate-800 italic">Folio #{pedidoEnProceso?.folio}</h4>
            </div>
            <div className="flex flex-col gap-6">
              <button 
                disabled={subiendo}
                onClick={confirmarEntregaFinal}
                className={`w-full ${subiendo ? 'bg-slate-300' : 'bg-emerald-600'} text-white py-5 rounded-[1.5rem] font-black text-lg flex items-center justify-center gap-4 shadow-xl active:scale-95 transition-all uppercase tracking-widest`}
              >
                {subiendo ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div> : <><CheckCircle size={26} /> Confirmar Entrega</>}
              </button>
              <div className="flex items-center gap-4 px-10"><div className="h-px bg-slate-200 flex-1"></div><span className="text-[9px] font-black text-slate-300 uppercase">o también</span><div className="h-px bg-slate-200 flex-1"></div></div>
              <button disabled={subiendo} onClick={cancelarCaptura} className="w-full bg-slate-100 text-slate-500 py-4 rounded-[1.2rem] font-black flex items-center justify-center gap-3 active:scale-95 transition-all uppercase tracking-widest text-xs border-2 border-slate-200/50">
                <Camera size={18} /> Tomar foto nuevamente
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-100 font-sans text-slate-900 overflow-x-hidden">
      <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={manejarFoto} />

      <div className="w-full px-2 py-6 sm:px-4 md:px-10 lg:px-16"> 
        <header className="w-full mb-8 border-b-2 border-slate-200 pb-6">
          <h1 className="text-2xl md:text-4xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
            <Package className="text-indigo-600" size={32} /> Hoja de Ruta
          </h1>
          <p className="text-slate-500 font-bold italic text-sm text-balance">Navegación en tiempo real para despachos</p>
        </header>

        <main className="w-full space-y-6 pb-20">
          {clientesAgrupados.map((cliente) => {
            const estaAbierto = expandido === cliente.idUnico;
            const mapaActivo = verMapa === cliente.idUnico;

            return (
              <div key={cliente.idUnico} className={`w-full bg-white rounded-[2.5rem] shadow-xl border-4 transition-all ${estaAbierto ? 'border-indigo-500' : 'border-transparent'}`}>
                
                <div 
                  className="p-6 md:p-10 cursor-pointer border-l-[16px] border-slate-900"
                  onClick={() => {
                    setExpandido(estaAbierto ? null : cliente.idUnico);
                    setVerMapa(null);
                  }}
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="bg-slate-900 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">Punto de Entrega</span>
                    {esTelefonoValido(cliente.telefono) && (
                      <a href={`tel:${cliente.telefono}`} onClick={(e) => e.stopPropagation()} className="bg-indigo-600 text-white p-3 rounded-full shadow-lg"><Phone size={20} /></a>
                    )}
                  </div>
                  
                  <h2 className="text-3xl md:text-5xl font-black text-slate-800 mb-2 uppercase italic leading-none break-words">{cliente.nombre}</h2>
                  <div className="flex items-start gap-2 text-slate-500 mb-8 font-bold"><MapPin size={22} className="text-indigo-500 shrink-0" /><p className="text-base md:text-lg leading-tight break-words">{cliente.direccion}</p></div>

                  <div className="flex justify-between items-end pt-6 border-t border-slate-100 gap-4">
                    <div className="flex-1">
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{estaAbierto ? 'Total Carga Cliente' : 'Pedidos Pendientes'}</p>
                      <p className="text-4xl font-black text-slate-800">{estaAbierto ? `$${cliente.totalGeneral.toLocaleString('es-CL')}` : cliente.pedidos.length}</p>
                    </div>
                    <div className="text-indigo-600 bg-indigo-50 p-3 rounded-full">{estaAbierto ? <ChevronUp size={32}/> : <ChevronDown size={32}/>}</div>
                  </div>
                </div>

                {estaAbierto && (
                  <div className="bg-slate-50 p-6 md:p-10 border-t-4 border-slate-100 w-full animate-in fade-in duration-300">
                    
                    {/* VISOR DE MAPA CON RUTA TRAZADA */}
                    {mapaActivo && posicionActual && (
                      <div className="w-full h-96 mb-10 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-xl animate-in zoom-in-95">
                        <iframe
                          width="100%"
                          height="100%"
                          frameBorder="0"
                          style={{ border: 0 }}
                          /* saddr: Origen (GPS Usuario) | daddr: Destino (Cliente) */
                          src={`https://maps.google.com/maps?saddr=${posicionActual.lat},${posicionActual.lng}&daddr=${encodeURIComponent(cliente.direccion)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                          allowFullScreen
                        ></iframe>
                      </div>
                    )}

                    {/* GRID DE PEDIDOS HIJOS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
                      {cliente.pedidos.map((p) => {
                        const esFactura = !!p.rut_cliente;
                        return (
                          <div key={p.id} className="bg-white rounded-[2rem] shadow-sm border-2 border-slate-200 overflow-hidden flex flex-col transition-all hover:shadow-md">
                            <div className={`p-4 text-white flex justify-between items-center ${esFactura ? 'bg-orange-600' : 'bg-blue-600'}`}>
                              <span className="text-xs font-black tracking-widest uppercase"># {p.folio}</span>
                              <div className="flex gap-2 text-[10px] font-bold">
                                <span>{formatearFechaChile(p.fecha_entrega)}</span>
                                <span>{p.hora_entrega}</span>
                              </div>
                            </div>

                            <div className="p-6 flex-1">
                              {esFactura && <div className="mb-4 text-orange-600 font-black text-[10px] border-b pb-1 uppercase italic">RUT: {p.rut_cliente}</div>}
                              <div className="space-y-2 mb-4">
                                {p.detalles_pedido?.map((det, idx) => (
                                  <div key={idx} className="flex justify-between text-xs text-slate-600 border-b border-slate-50 pb-1">
                                    <span className="font-bold uppercase truncate pr-4">{det.descripcion}</span>
                                    <span className="font-black shrink-0">x{det.cantidad}</span>
                                  </div>
                                ))}
                              </div>
                              {p.quien_recibe && p.quien_recibe.trim() !== "" && (
                                <div className="mt-4 flex items-center gap-2 text-indigo-600 bg-indigo-50 p-3 rounded-xl">
                                  <UserCheck size={16} />
                                  <p className="text-[10px] font-black uppercase truncate italic">Recibe: {p.quien_recibe}</p>
                                </div>
                              )}
                            </div>

                            <div className="p-6 bg-slate-50 border-t flex justify-between items-center">
                              <span className="text-2xl font-black text-emerald-600">${Number(p.total_pedido).toLocaleString('es-CL')}</span>
                              <button onClick={() => iniciarCaptura(p)} className="bg-emerald-500 text-white p-3 rounded-2xl shadow-lg active:scale-90 transition hover:bg-emerald-600"><Camera size={24}/></button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-col gap-6 w-full">
                      {/* Botón GPS: Activa geolocalización y muestra la ruta en el iframe superior */}
                      <button 
                        onClick={() => activarNavegacion(cliente.idUnico)}
                        className="bg-slate-800 text-white py-5 rounded-[1.5rem] font-black flex items-center justify-center gap-4 shadow-2xl uppercase tracking-widest text-lg hover:bg-slate-900 transition"
                      >
                        <Navigation size={26}/> {mapaActivo ? "Actualizar Mi Ubicación" : "Iniciar GPS (Ver Ruta)"}
                      </button>
                      
                      {cliente.pedidos.length > 1 && (
                        <button onClick={() => iniciarCaptura(cliente.pedidos[0])} className="bg-emerald-600 text-white py-5 rounded-[1.5rem] font-black flex items-center justify-center gap-4 shadow-2xl uppercase tracking-widest text-lg hover:bg-emerald-700 transition"><CheckCircle size={26}/> Confirmar Entrega Total</button>
                      )}

                      <button onClick={() => setExpandido(null)} className="bg-slate-200 text-slate-600 py-4 rounded-[1.5rem] font-black flex items-center justify-center gap-3 uppercase tracking-widest text-xs hover:bg-slate-300 transition"><XCircle size={20}/> Cerrar Detalles</button>
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