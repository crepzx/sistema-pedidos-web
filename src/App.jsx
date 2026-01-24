import React, { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Routes, Route } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine'; // Importante para la línea de ruta
import { 
  MapPin, Clock, Navigation, CheckCircle, 
  ChevronDown, ChevronUp, Package, UserCheck, 
  Phone, XCircle, Calendar, Camera, RotateCcw, 
  Minimize2, Navigation2
} from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL, 
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// --- ICONO PERSONALIZADO ---
const iconoRepartidor = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
    iconSize: [35, 35],
    iconAnchor: [17, 35]
});

// --- COMPONENTE DE RUTA Y CENTRADO ---
function ControladorRuta({ origen, destino }) {
  const map = useMap();
  const routingControlRef = useRef(null);

  useEffect(() => {
    if (!map || !origen || !destino) return;

    // 1. Solución al cuadro gris: Forzar recalculado de tamaño
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    // 2. Dibujar la ruta (Línea Azul)
    if (routingControlRef.current) {
      map.removeControl(routingControlRef.current);
    }

    // Geocodificar destino (simplificado: Leaflet Routing lo hace por texto o coord)
    // Para mayor precisión, aquí usamos la dirección directamente
    routingControlRef.current = L.Routing.control({
      waypoints: [
        L.latLng(origen.lat, origen.lng),
        destino // Puede ser string (dirección) o latLng
      ],
      lineOptions: {
        styles: [{ color: '#4f46e5', weight: 6 }] // Color Indigo de Tailwind
      },
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: false, // Evita que se aleje para ver toda la ruta
      show: false, // Oculta el cuadro de texto con instrucciones
      createMarker: () => null // No crear marcadores extra
    }).addTo(map);

    // 3. Centrar siempre en el usuario con Zoom de calle
    map.setView([origen.lat, origen.lng], 18);

    return () => {
      if (routingControlRef.current) map.removeControl(routingControlRef.current);
    };
  }, [origen, destino, map]);

  return null;
}

function ContenedorPedidos() {
  const [clientesAgrupados, setClientesAgrupados] = useState([]);
  const [expandido, setExpandido] = useState(null);
  const [verMapa, setVerMapa] = useState(null); 
  const [posicionActual, setPosicionActual] = useState(null);
  const [mapaFullscreen, setMapaFullscreen] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [pedidoEnProceso, setPedidoEnProceso] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  
  const fileInputRef = useRef(null);
  const watchId = useRef(null);

  useEffect(() => {
    fetchPedidos();
    return () => { if (watchId.current) navigator.geolocation.clearWatch(watchId.current); };
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
            idUnico: clienteID, nombre: current.nombre_cliente,
            direccion: current.direccion_cliente, telefono: current.telefono,
            totalGeneral: 0, pedidos: []
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

  const iniciarNavegacion = (clienteId) => {
    if (!navigator.geolocation) return alert("GPS no disponible");
    setVerMapa(clienteId);
    setMapaFullscreen(true); 

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosicionActual({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => alert("Activa el GPS."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const detenerNavegacion = () => {
    if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
    setVerMapa(null);
    setMapaFullscreen(false);
    setPosicionActual(null);
  };

  const manejarFoto = (e) => {
    const archivo = e.target.files[0];
    if (archivo) {
      const reader = new FileReader();
      reader.onloadend = () => setFotoPreview(reader.result);
      reader.readAsDataURL(archivo);
    }
  };

  const confirmarEntregaFinal = async () => {
    setSubiendo(true);
    try {
      const base64Data = fotoPreview.split(',')[1];
      const blob = await fetch(`data:image/jpeg;base64,${base64Data}`).then(res => res.blob());
      const nombre = `entrega_${pedidoEnProceso.folio}_${Date.now()}.jpg`;
      await supabase.storage.from('evidencias').upload(`public/${nombre}`, blob);
      const { data: urlData } = supabase.storage.from('evidencias').getPublicUrl(`public/${nombre}`);
      await supabase.from('pedidos').update({ estado_entregado: true, url_foto: urlData.publicUrl }).eq('id', pedidoEnProceso.id);
      setFotoPreview(null); setPedidoEnProceso(null); fetchPedidos();
    } catch (e) { alert("Error al subir."); }
    setSubiendo(false);
  };

  if (cargando) return <div className="h-screen w-full flex items-center justify-center font-black text-indigo-600 animate-pulse text-2xl">CARGANDO...</div>;

  // --- MODO PANTALLA COMPLETA ---
  if (mapaFullscreen && posicionActual) {
    const clienteActivo = clientesAgrupados.find(c => c.idUnico === verMapa);
    return (
      <div className="fixed inset-0 z-[500] bg-white flex flex-col overflow-hidden animate-in fade-in">
        <div className="absolute top-6 left-4 right-4 z-[510] flex gap-2">
          <button onClick={detenerNavegacion} className="bg-white p-4 rounded-2xl shadow-2xl text-red-500 active:scale-90 transition border border-slate-100">
            <XCircle size={26} />
          </button>
          <div className="flex-1 bg-white/95 backdrop-blur px-5 py-3 rounded-2xl shadow-2xl border border-slate-100">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">En camino a</p>
            <p className="text-xs font-black text-slate-800 truncate uppercase">{clienteActivo?.nombre}</p>
          </div>
        </div>

        <div className="flex-1 w-full h-full relative z-[501]">
          <MapContainer 
            center={[posicionActual.lat, posicionActual.lng]} 
            zoom={18} 
            zoomControl={false}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={[posicionActual.lat, posicionActual.lng]} icon={iconoRepartidor} />
            <ControladorRuta origen={posicionActual} destino={clienteActivo.direccion} />
          </MapContainer>
        </div>

        <div className="absolute bottom-6 left-6 right-6 z-[510]">
          <button onClick={() => setMapaFullscreen(false)} className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black uppercase text-[10px] shadow-2xl flex items-center justify-center gap-3">
            <Minimize2 size={18} /> Salir de pantalla completa
          </button>
        </div>
      </div>
    );
  }

  // --- VISTA PREVIA FOTO ---
  if (fotoPreview) {
    return (
      <div className="fixed inset-0 z-[250] bg-slate-900 flex items-center justify-center p-2">
        <div className="w-full max-w-sm bg-white rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[98vh]">
          <div className="p-4 border-b flex items-center justify-between"><div className="flex items-center gap-2 text-indigo-600 font-black text-[10px] uppercase"><Camera size={18} /> Validar</div><XCircle onClick={() => setFotoPreview(null)} className="text-slate-300 cursor-pointer" size={24} /></div>
          <div className="bg-black flex-shrink-0 h-[30vh] flex items-center justify-center"><img src={fotoPreview} className="h-full w-full object-contain" alt="Evidencia" /></div>
          <div className="p-6 flex-1 flex flex-col justify-between">
            <h4 className="text-2xl font-black text-slate-800 text-center mb-6 uppercase">Folio #{pedidoEnProceso?.folio}</h4>
            <div className="flex flex-col gap-3">
              <button disabled={subiendo} onClick={confirmarEntregaFinal} className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-base uppercase">{subiendo ? "Subiendo..." : "Confirmar Entrega"}</button>
              <button onClick={() => { setFotoPreview(null); fileInputRef.current.click(); }} className="w-full bg-slate-100 text-indigo-700 py-3 rounded-2xl font-black text-xs uppercase">Repetir Foto</button>
              <button onClick={() => { setFotoPreview(null); setPedidoEnProceso(null); }} className="w-full bg-white text-slate-400 py-2 rounded-2xl font-bold text-[10px] uppercase">Cancelar</button>
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
        <header className="w-full mb-10 border-b-2 border-slate-200 pb-6 px-4">
          <h1 className="text-3xl md:text-5xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter italic"><Package className="text-indigo-600 shrink-0" size={36} /> Hoja de Ruta</h1>
        </header>

        <main className="w-full space-y-6 pb-20 px-2">
          {clientesAgrupados.map((cliente) => {
            const estaAbierto = expandido === cliente.idUnico;
            return (
              <div key={cliente.idUnico} className={`w-full bg-white rounded-[2.5rem] shadow-xl border-4 transition-all ${estaAbierto ? 'border-indigo-500' : 'border-transparent'}`}>
                <div className="p-6 md:p-10 cursor-pointer border-l-[16px] border-slate-900" onClick={() => setExpandido(estaAbierto ? null : cliente.idUnico)}>
                   <h2 className="text-3xl font-black text-slate-800 mb-2 uppercase leading-none">{cliente.nombre}</h2>
                   <div className="flex items-start gap-2 text-slate-500 mb-8 font-bold"><MapPin size={22} className="text-indigo-500" /><p className="text-base">{cliente.direccion}</p></div>
                   <div className="flex justify-between items-center pt-6 border-t border-slate-100">
                    <p className="text-4xl font-black text-slate-800">{estaAbierto ? `$${cliente.totalGeneral.toLocaleString('es-CL')}` : cliente.pedidos.length + ' Pedidos'}</p>
                    <div className="text-indigo-600 bg-indigo-50 p-3 rounded-full">{estaAbierto ? <ChevronUp size={32}/> : <ChevronDown size={32}/>}</div>
                  </div>
                </div>

                {estaAbierto && (
                  <div className="bg-slate-50 p-4 md:p-10 border-t-4 border-slate-100 w-full animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                      {cliente.pedidos.map((p) => (
                        <div key={p.id} className="bg-white rounded-[2rem] shadow-sm border-2 border-slate-200 p-6 flex justify-between items-center">
                          <div>
                            <span className="text-xs font-black uppercase text-slate-400"># {p.folio}</span>
                            <p className="text-2xl font-black text-emerald-600">${Number(p.total_pedido).toLocaleString('es-CL')}</p>
                          </div>
                          <button onClick={() => { setPedidoEnProceso(p); fileInputRef.current.click(); }} className="bg-emerald-500 text-white p-4 rounded-2xl shadow-lg active:scale-90 transition"><Camera size={24}/></button>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => iniciarNavegacion(cliente.idUnico)} className="w-full bg-slate-800 text-white py-6 rounded-[2rem] font-black flex items-center justify-center gap-4 shadow-2xl uppercase tracking-widest text-lg"><Navigation2 size={28}/> Iniciar GPS (En Vivo)</button>
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

export default function App() { return ( <Routes><Route path="/" element={<ContenedorPedidos />} /><Route path="*" element={<div className="h-screen w-full flex items-center justify-center font-black text-slate-300 text-5xl italic uppercase tracking-tighter">POS DELIVERY</div>} /></Routes> ); }