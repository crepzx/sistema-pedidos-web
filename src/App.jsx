import React, { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Routes, Route } from 'react-router-dom';
import { 
  MapPin, Clock, Navigation, CheckCircle, 
  ChevronDown, ChevronUp, Package, UserCheck, 
  Search, AlertCircle, Phone, XCircle, Calendar,
  Camera, ArrowLeft, Image as ImageIcon, UploadCloud
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
    // Ahora cargamos todos los pedidos que NO han sido entregados
    const { data, error } = await supabase
      .from('pedidos')
      .select('*, detalles_pedido!pedido_id(*)') 
      .eq('estado_entregado', false)
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

  async function subirFoto(archivoBase64, folio) {
    try {
      // Convertir Base64 a Blob (el formato que requiere el Storage)
      const base64Data = archivoBase64.split(',')[1];
      const blob = await fetch(`data:image/jpeg;base64,${base64Data}`).then(res => res.blob());
      
      const nombreArchivo = `entrega_${folio}_${Date.now()}.jpg`;
      const rutaArchivo = `public/${nombreArchivo}`;

      // Subir al bucket 'evidencias'
      const { data, error } = await supabase.storage
        .from('evidencias')
        .upload(rutaArchivo, blob, { contentType: 'image/jpeg' });

      if (error) throw error;

      // Obtener la URL pública para guardarla en la base de datos
      const { data: urlData } = supabase.storage
        .from('evidencias')
        .getPublicUrl(rutaArchivo);

      return urlData.publicUrl;
    } catch (err) {
      console.error("Error al subir foto:", err.message);
      return null;
    }
  }

  // --- LÓGICA DE CÁMARA ---
  const iniciarCaptura = (pedido) => {
    setPedidoEnProceso(pedido);
    fileInputRef.current.click(); // Dispara el selector de archivos (cámara en móvil)
  };

  const manejarFoto = (e) => {
    const archivo = e.target.files[0];
    if (archivo) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFotoPreview(reader.result);
      };
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

    // 1. Subir la imagen primero
    const urlFoto = await subirFoto(fotoPreview, pedidoEnProceso.folio);

    if (!urlFoto) {
      alert("Error al subir la evidencia. Intente nuevamente.");
      setSubiendo(false);
      return;
    }

    // 2. Actualizar el pedido en la base de datos (puedes añadir una columna 'url_foto')
    const { error } = await supabase
      .from('pedidos')
      .update({ 
        estado_entregado: true,
        // url_foto: urlFoto // Opcional: crea esta columna en Supabase si quieres guardar el link
      })
      .eq('id', pedidoEnProceso.id);

    if (!error) {
      alert(`Folio #${pedidoEnProceso.folio} entregado y evidencia guardada.`);
      cancelarCaptura();
      fetchPedidos();
    } else {
      alert("Error al actualizar estado: " + error.message);
    }
    setSubiendo(false);
  };

  if (cargando) return <div className="flex h-screen w-full items-center justify-center font-black text-indigo-600">CARGANDO HOJA DE RUTA...</div>;

  // --- VISTA DE PREVISUALIZACIÓN DE FOTO ---
  if (fotoPreview) {
    return (
      <div className="fixed inset-0 z-[200] bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-[2.5rem] overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <ImageIcon className="text-indigo-600" />
            <h3 className="font-black text-slate-800 uppercase tracking-tighter">Verificación de Entrega</h3>
          </div>
          
          <div className="aspect-square w-full bg-slate-200">
            <img src={fotoPreview} alt="Entrega" className="w-full h-full object-cover" />
          </div>

          <div className="p-8 text-center">
            <p className="text-slate-500 text-sm font-bold mb-1 uppercase tracking-widest">Pedido</p>
            <h4 className="text-2xl font-black text-slate-800 mb-6">Folio #{pedidoEnProceso?.folio}</h4>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={confirmarEntregaFinal}
                className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl active:scale-95 transition uppercase tracking-widest"
              >
                <CheckCircle size={24} /> Confirmar Entrega
              </button>
              <button 
                onClick={cancelarCaptura}
                className="w-full bg-slate-100 text-slate-500 py-4 rounded-2xl font-black flex items-center justify-center gap-3 active:scale-95 transition uppercase tracking-widest text-xs"
              >
                <ArrowLeft size={18} /> Tomar otra foto
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-100 font-sans text-slate-900 overflow-x-hidden">
      {/* Input oculto para cámara */}
      <input 
        type="file" 
        accept="image/*" 
        capture="environment" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={manejarFoto}
      />

      <div className="w-full px-2 py-6 sm:px-4 md:px-10 lg:px-16"> 
        <header className="w-full mb-8 border-b-2 border-slate-200 pb-6">
          <h1 className="text-2xl md:text-4xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
            <Package className="text-indigo-600" size={32} /> Hoja de Ruta
          </h1>
          <p className="text-slate-500 font-bold italic text-sm">Carga automática de terminal</p>
        </header>

        <main className="w-full space-y-6 pb-20">
          {clientesAgrupados.map((cliente) => {
            const estaAbierto = expandido === cliente.idUnico;
            return (
              <div key={cliente.idUnico} className={`w-full bg-white rounded-[2.5rem] shadow-xl border-4 transition-all ${estaAbierto ? 'border-indigo-500' : 'border-transparent'}`}>
                
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
                  
                  <h2 className="text-3xl md:text-4xl font-black text-slate-800 mb-2 uppercase italic leading-tight break-words">{cliente.nombre}</h2>
                  
                  <div className="flex items-start gap-2 text-slate-500 mb-8">
                    <MapPin size={22} className="text-indigo-500 shrink-0" />
                    <p className="text-base md:text-lg font-bold leading-tight break-words">{cliente.direccion}</p>
                  </div>

                  <div className="flex justify-between items-end pt-6 border-t border-slate-100">
                    <div className="flex-1">
                      {estaAbierto ? (
                        <div>
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

                {estaAbierto && (
                  <div className="bg-slate-50 p-6 md:p-10 border-t-4 border-slate-100 w-full animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
                      {cliente.pedidos.map((p) => {
                        const esFactura = !!p.rut_cliente;
                        return (
                          <div key={p.id} className="bg-white rounded-[2rem] shadow-sm border-2 border-slate-200 overflow-hidden flex flex-col">
                            <div className={`p-4 text-white flex justify-between items-center ${esFactura ? 'bg-orange-600' : 'bg-blue-600'}`}>
                              <span className="text-xs font-black tracking-widest uppercase"># {p.folio}</span>
                              <div className="flex gap-2 text-[10px] font-bold">
                                <span className="flex items-center gap-1">
                                  <Calendar size={12}/> {formatearFechaChile(p.fecha_entrega)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock size={12}/> {p.hora_entrega}
                                </span>
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
                              <button 
                                onClick={() => iniciarCaptura(p)}
                                className="bg-emerald-500 text-white p-3 rounded-2xl shadow-lg hover:scale-105 transition"
                              >
                                <Camera size={24}/>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-col gap-4 w-full">
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cliente.direccion)}&travelmode=driving`} target="_blank" rel="noreferrer" className="bg-slate-800 text-white py-5 rounded-[1.5rem] font-black flex items-center justify-center gap-4 shadow-2xl uppercase tracking-widest text-lg">
                        <Navigation size={26}/> Iniciar GPS
                      </a>
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