import React, { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Routes, Route } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';
import 'leaflet-control-geocoder';

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

// --- 1. CONFIGURACIÓN DE ICONOS ---
const iconoRepartidor = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -38]
});

const iconoCliente = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/447/447031.png',
    iconSize: [35, 35],
    iconAnchor: [17, 35]
});

// --- 2. UTILIDADES ---
const formatearFechaChile = (fechaStr) => {
  if (!fechaStr) return '--/--/----';
  const [year, month, day] = fechaStr.split('-');
  return `${day}-${month}-${year}`;
};

// --- 3. SUB-COMPONENTE: MOTOR DE RUTAS Y CENTRADO ---
function RoutingEngine({ origen, direccionDestino }) {
  const map = useMap();
  const routingRef = useRef(null);

  useEffect(() => {
    if (!map || !origen || !direccionDestino) return;

    // Forzar recalculo de tamaño para evitar cuadros grises
    setTimeout(() => { map.invalidateSize(); }, 200);

    if (routingRef.current) map.removeControl(routingRef.current);

    // Buscador de direcciones (Geocoder)
    const geocoder = L.Control.Geocoder.nominatim();

    geocoder.geocode(direccionDestino, (results) => {
      if (results && results.length > 0) {
        const dest = results[0].center;

        routingRef.current = L.Routing.control({
          waypoints: [
            L.latLng(origen.lat, origen.lng),
            L.latLng(dest.lat, dest.lng)
          ],
          router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
          lineOptions: { styles: [{ color: '#6366f1', weight: 6, opacity: 0.8 }] },
          addWaypoints: false,
          draggableWaypoints: false,
          fitSelectedRoutes: false,
          show: false, // Oculta panel de instrucciones
          createMarker: () => null // Usamos nuestros propios Marker components
        }).addTo(map);

        // Centrado dinámico sobre el usuario
        map.setView([origen.lat, origen.lng], 17);
      }
    });

    return () => { if (routingRef.current) map.removeControl(routingRef.current); };
  }, [origen, direccionDestino, map]);

  return null;
}

// --- 4. COMPONENTE PRINCIPAL ---
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
            idUnico: clienteID, nombre: current.nombre_cliente, rut: current.rut_cliente,
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
    setVerMapa(null); setMapaFullscreen(false); setPosicionActual(null);
  };

  const iniciarCaptura = (pedido) => {
    setPedidoEnProceso(pedido);
    if (fileInputRef.current) fileInputRef.current.value = ""; 
    setTimeout(() => fileInputRef.current.click(), 150);
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

  // --- RENDER: MAPA LEAFLET ---
  if (mapaFullscreen && posicionActual) {
    const clienteActivo = clientesAgrupados.find(c => c.idUnico === verMapa);
    return (
      <div className="fixed inset-0 z-[500] bg-white flex flex-col overflow-hidden animate-in fade-in">
        <div className="absolute top-6 left-4 right-4 z-[510] flex gap-2">
          <button onClick={detenerNavegacion} className="bg-white p-4 rounded-2xl shadow-2xl text-red-500 active:scale-90 transition border border-slate-100"><XCircle size={26} /></button>
          <div className="flex-1 bg-white/95 backdrop-blur px-5 py-3 rounded-2xl shadow-2xl border border-slate-100 flex flex-col justify-center">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">En camino a</p>
            <p className="text-xs font-black text-slate-800 truncate uppercase italic">{clienteActivo?.nombre}</p>
          </div>
        </div>

        <MapContainer center={[posicionActual.lat, posicionActual.lng]} zoom={17} zoomControl={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
          <Marker position={[posicionActual.lat, posicionActual.lng]} icon={iconoRepartidor}>
            <Popup><span className="font-bold uppercase text-[10px]">Tu Ubicación</span></Popup>
          </Marker>
          <RoutingEngine origen={posicionActual} direccionDestino={clienteActivo.direccion} />
        </MapContainer>

        <div className="absolute bottom-8 left-8 right-8 z-[510]">
          <button onClick={() => setMapaFullscreen(false)} className="w-full bg-slate-900 text-white py-5 rounded-[2rem] font-black uppercase text-[10px] shadow-2xl flex items-center justify-center gap-3">
            <Minimize2 size={18} /> Salir de navegación
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
          <div className="bg-black flex-shrink-0 h-[28vh] flex items-center justify-center overflow-hidden"><img src={fotoPreview} className="h-full w-full object-contain" /></div>
          <div className="p-6 flex-1 flex flex-col justify-between text-center">
            <h4 className="text-2xl font-black text-slate-800 italic uppercase leading-none mb-6">Folio #{pedidoEnProceso?.folio}</h4>
            <div className="flex flex-col gap-3">
              <button disabled={subiendo} onClick={confirmarEntregaFinal} className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-base shadow-xl active:scale-95 transition-all uppercase">{subiendo ? "Subiendo..." : "Confirmar Entrega"}</button>
              <button onClick={() => { setFotoPreview(null); fileInputRef.current.click(); }} className="w-full bg-slate-100 text-indigo-700 py-3 rounded-2xl font-black text-xs uppercase italic border border-indigo-50 font-black">Repetir Foto</button>
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
        <header className="mb-10 border-b-2 border-slate-200 pb-6 px-4">
          <h1 className="text-3xl md:text-5xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter italic"><Package className="text-indigo-600 shrink-0" size={36} /> Hoja de Ruta</h1>
        </header>

        <main className="space-y-6 pb-20 px-2">
          {clientesAgrupados.map((cliente) => {
            const estaAbierto = expandido === cliente.idUnico;
            return (
              <div key={cliente.idUnico} className={`w-full bg-white rounded-[2.5rem] shadow-xl border-4 transition-all ${estaAbierto ? 'border-indigo-500' : 'border-transparent'}`}>
                <div className="p-6 md:p-10 cursor-pointer border-l-[16px] border-slate-900" onClick={() => { setExpandido(estaAbierto ? null : cliente.idUnico); detenerNavegacion(); }}>
                   <div className="flex justify-between items-start mb-4"><span className="bg-slate-900 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">Punto de Entrega</span>{cliente.telefono && <a href={`tel:${cliente.telefono}`} onClick={(e) => e.stopPropagation()} className="bg-indigo-600 text-white p-3 rounded-full shadow-lg"><Phone size={20} /></a>}</div>
                   <h2 className="text-3xl md:text-5xl font-black text-slate-800 mb-2 uppercase italic leading-none break-words tracking-tighter">{cliente.nombre}</h2>
                   <div className="flex items-start gap-2 text-slate-500 mb-8 font-bold"><MapPin size={22} className="text-indigo-500 shrink-0" /><p className="text-base md:text-lg leading-tight break-words italic uppercase">{cliente.direccion}</p></div>
                   <div className="flex justify-between items-end pt-6 border-t border-slate-100">
                    <div className="flex-1"><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{estaAbierto ? 'Total Acumulado' : 'Pedidos'}</p><p className="text-4xl font-black text-slate-800 tracking-tighter">{estaAbierto ? `$${cliente.totalGeneral.toLocaleString('es-CL')}` : cliente.pedidos.length}</p></div>
                    <div className="text-indigo-600 bg-indigo-50 p-3 rounded-full">{estaAbierto ? <ChevronUp size={32}/> : <ChevronDown size={32}/>}</div>
                  </div>
                </div>

                {estaAbierto && (
                  <div className="bg-slate-50 p-4 md:p-10 border-t-4 border-slate-100 w-full animate-in fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
                      {cliente.pedidos.map((p) => {
                        const esFactura = !!p.rut_cliente;
                        return (
                          <div key={p.id} className="bg-white rounded-[2rem] shadow-sm border-2 border-slate-200 overflow-hidden flex flex-col">
                            <div className={`p-4 text-white flex justify-between items-center ${esFactura ? 'bg-orange-600' : 'bg-blue-600'}`}><span className="text-xs font-black uppercase tracking-widest"># {p.folio}</span><div className="flex gap-2 text-[9px] font-bold"><span>{formatearFechaChile(p.fecha_entrega)}</span><span>{p.hora_entrega}</span></div></div>
                            <div className="p-6 flex-1">
                              {esFactura && <div className="mb-4 text-orange-600 font-black text-[10px] border-b pb-1 uppercase italic">RUT: {p.rut_cliente}</div>}
                              <div className="space-y-2 mb-4">{p.detalles_pedido?.map((det, idx) => (<div key={idx} className="flex justify-between text-xs text-slate-600 border-b border-slate-50 pb-1"><span className="font-bold uppercase truncate pr-4">{det.descripcion}</span><span className="font-black shrink-0">x{det.cantidad}</span></div>))}</div>
                            </div>
                            <div className="p-6 bg-slate-50 border-t flex justify-between items-center"><span className="text-2xl font-black text-emerald-600 tracking-tighter">${Number(p.total_pedido).toLocaleString('es-CL')}</span><button onClick={() => iniciarCaptura(p)} className="bg-emerald-500 text-white p-3 rounded-2xl shadow-lg active:scale-90 transition"><Camera size={24}/></button></div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex flex-col gap-6 w-full">
                      <button onClick={() => iniciarNavegacion(cliente.idUnico)} className="bg-slate-800 text-white py-6 rounded-[2rem] font-black flex items-center justify-center gap-4 shadow-2xl uppercase tracking-widest text-lg active:scale-95 transition-all"><Navigation2 size={28}/> Iniciar GPS (Leaflet Map)</button>
                      <button onClick={() => { setExpandido(null); detenerNavegacion(); }} className="bg-slate-200 text-slate-600 py-4 rounded-[1.5rem] font-black flex items-center justify-center gap-3 uppercase tracking-widest text-xs"><XCircle size={20}/> Cerrar Detalles</button>
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

export default function App() { return ( <Routes><Route path="/" element={<ContenedorPedidos />} /><Route path="*" element={<div className="h-screen w-full flex items-center justify-center font-black text-slate-300 text-5xl italic uppercase tracking-tighter">POS DELIVERY</div>} /></Routes> ); }