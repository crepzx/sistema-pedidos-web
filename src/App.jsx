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
  Phone, XCircle, Camera, RotateCcw, 
  Minimize2, Navigation2, ShoppingBag, DollarSign
} from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL, 
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// --- 1. CONFIGURACIÓN VISUAL (ICONOS) ---
const iconoRepartidor = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
    iconSize: [40, 40], iconAnchor: [20, 40]
});

const iconoCliente = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/1219/1219321.png',
    iconSize: [42, 42], iconAnchor: [21, 42]
});

// --- 2. UTILIDADES ---
const formatearFechaChile = (f) => f ? f.split('-').reverse().join('-') : '--/--/----';

// --- 3. MOTOR DE MAPA: BÚSQUEDA Y RUTA ---
function MotorLogistico({ origen, direccionDestino }) {
  const map = useMap();
  const routingRef = useRef(null);
  const [coordsDestino, setCoordsDestino] = useState(null);

  useEffect(() => {
    if (!map || !origen || !direccionDestino) return;

    // Reparar visualización en móviles
    setTimeout(() => { map.invalidateSize(); }, 400);

    const geocoder = L.Control.Geocoder.nominatim();
    const queryCompleta = `${direccionDestino}, Coquimbo, Chile`;

    geocoder.geocode(queryCompleta, (results) => {
      if (results && results.length > 0) {
        const dest = results[0].center;
        setCoordsDestino(dest);

        if (routingRef.current) map.removeControl(routingRef.current);
        
        routingRef.current = L.Routing.control({
          waypoints: [L.latLng(origen.lat, origen.lng), L.latLng(dest.lat, dest.lng)],
          router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
          lineOptions: { styles: [{ color: '#6366f1', weight: 8, opacity: 0.9 }] },
          addWaypoints: false, draggableWaypoints: false,
          fitSelectedRoutes: false, show: false, createMarker: () => null
        }).addTo(map);
      }
    });

    map.setView([origen.lat, origen.lng], 17);
    return () => { if (routingRef.current) map.removeControl(routingRef.current); };
  }, [origen, direccionDestino, map]);

  return coordsDestino ? <Marker position={[coordsDestino.lat, coordsDestino.lng]} icon={iconoCliente} /> : null;
}

// --- 4. COMPONENTE PRINCIPAL ---
function ContenedorPedidos() {
  const [clientes, setClientes] = useState([]);
  const [expandido, setExpandido] = useState(null);
  const [verMapa, setVerMapa] = useState(null); 
  const [posicionActual, setPosicionActual] = useState(null);
  const [mapaFullscreen, setMapaFullscreen] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [pedidoActivo, setPedidoActivo] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  
  const fileRef = useRef(null);
  const watchId = useRef(null);

  useEffect(() => {
    fetchData();
    return () => { if (watchId.current) navigator.geolocation.clearWatch(watchId.current); };
  }, []);

  async function fetchData() {
    setCargando(true);
    const { data, error } = await supabase.from('pedidos').select('*, detalles_pedido!pedido_id(*)').eq('estado_entregado', false);
    if (!error) {
      const agrupados = data.reduce((acc, curr) => {
        const id = curr.rut_cliente || curr.nombre_cliente;
        if (!acc[id]) acc[id] = { id, nombre: curr.nombre_cliente, direccion: curr.direccion_cliente, pedidos: [], total: 0 };
        acc[id].pedidos.push(curr);
        acc[id].total += Number(curr.total_pedido);
        return acc;
      }, {});
      setClientes(Object.values(agrupados));
    }
    setCargando(false);
  }

  const handleGPS = (id) => {
    setVerMapa(id);
    setMapaFullscreen(true);
    watchId.current = navigator.geolocation.watchPosition(
      (p) => setPosicionActual({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => alert("Activa GPS"),
      { enableHighAccuracy: true }
    );
  };

  const handleFoto = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFotoPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const subirEntrega = async () => {
    setSubiendo(true);
    try {
      const blob = await fetch(fotoPreview).then(r => r.blob());
      const fileName = `pos_${pedidoActivo.folio}_${Date.now()}.jpg`;
      await supabase.storage.from('evidencias').upload(`public/${fileName}`, blob);
      const { data: url } = supabase.storage.from('evidencias').getPublicUrl(`public/${fileName}`);
      await supabase.from('pedidos').update({ estado_entregado: true, url_foto: url.publicUrl }).eq('id', pedidoActivo.id);
      setFotoPreview(null); fetchData();
    } catch (e) { alert("Error"); }
    setSubiendo(false);
  };

  if (cargando) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white font-black text-2xl animate-pulse italic">SISTEMA POS DELIVERY...</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <input type="file" accept="image/*" capture="environment" ref={fileRef} className="hidden" onChange={handleFoto} />
      
      {/* HEADER DISEÑADO */}
      <header className="bg-slate-900 text-white p-6 shadow-2xl rounded-b-[3rem] mb-8">
        <div className="flex justify-between items-center max-w-6xl mx-auto">
          <div>
            <h1 className="text-2xl font-black italic tracking-tighter uppercase flex items-center gap-2">
              <ShoppingBag className="text-indigo-400" /> POS Logística
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Coquimbo, Región de Coquimbo</p>
          </div>
          <div className="bg-indigo-600/20 p-3 rounded-2xl border border-indigo-500/30">
            <Calendar size={20} className="text-indigo-400" />
          </div>
        </div>
      </header>

      {/* LISTADO DE CLIENTES (CARDS PRINCIPALES) */}
      <main className="max-w-4xl mx-auto px-4 space-y-6">
        {clientes.map((c) => {
          const isOpen = expandido === c.id;
          return (
            <div key={c.id} className={`bg-white rounded-[2.5rem] shadow-xl overflow-hidden transition-all duration-300 border-2 ${isOpen ? 'border-indigo-500 ring-4 ring-indigo-50' : 'border-transparent'}`}>
              <div className="p-6 md:p-8 cursor-pointer" onClick={() => setExpandido(isOpen ? null : c.id)}>
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-slate-100 text-slate-600 text-[9px] font-black px-4 py-1.5 rounded-full uppercase">Punto de Entrega</span>
                  <div className="flex gap-2">
                    <a href={`tel:${c.pedidos[0].telefono}`} onClick={e => e.stopPropagation()} className="bg-emerald-500 text-white p-3 rounded-xl shadow-lg"><Phone size={18}/></a>
                  </div>
                </div>
                <h2 className="text-3xl font-black text-slate-800 uppercase italic leading-none mb-2">{c.nombre}</h2>
                <p className="text-slate-500 font-bold text-sm flex items-center gap-2 mb-6 uppercase"><MapPin size={16} className="text-indigo-500"/> {c.direccion}</p>
                
                <div className="flex justify-between items-center pt-4 border-t border-slate-50">
                  <div className="flex items-center gap-4">
                    <div className="bg-slate-900 text-white px-4 py-2 rounded-2xl font-black text-sm">{c.pedidos.length} {c.pedidos.length === 1 ? 'PEDIDO' : 'PEDIDOS'}</div>
                    <div className="text-indigo-600 font-black text-xl">${c.total.toLocaleString('es-CL')}</div>
                  </div>
                  {isOpen ? <ChevronUp size={28} className="text-slate-300"/> : <ChevronDown size={28} className="text-slate-300"/>}
                </div>
              </div>

              {/* DETALLE DE PEDIDOS HIJOS */}
              {isOpen && (
                <div className="bg-slate-50 p-6 space-y-4 animate-in slide-in-from-top-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {c.pedidos.map((p) => (
                      <div key={p.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 flex justify-between items-center">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="bg-indigo-600 text-white text-[8px] font-black px-2 py-0.5 rounded uppercase">Folio #{p.folio}</span>
                            <span className="text-slate-400 text-[10px] font-bold">{p.hora_entrega}</span>
                          </div>
                          <div className="space-y-1 mt-2">
                            {p.detalles_pedido?.map((det, idx) => (
                              <p key={idx} className="text-[11px] font-bold text-slate-600 uppercase pr-2 line-clamp-1 border-b border-slate-50 pb-0.5">
                                • {det.descripcion} <span className="text-indigo-500">x{det.cantidad}</span>
                              </p>
                            ))}
                          </div>
                        </div>
                        <button onClick={() => { setPedidoActivo(p); fileRef.current.click(); }} className="bg-slate-100 text-indigo-600 p-4 rounded-2xl active:bg-indigo-600 active:text-white transition-colors">
                          <Camera size={24}/>
                        </button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => handleGPS(c.id)} className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black uppercase text-sm shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-transform">
                    <Navigation2 size={20}/> Iniciar Ruta OSM
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </main>

      {/* MAPA FULLSCREEN */}
      {mapaFullscreen && posicionActual && (
        <div className="fixed inset-0 z-[1000] bg-white flex flex-col">
          <div className="absolute top-6 left-4 right-4 z-[1100] flex gap-2">
            <button onClick={() => { setMapaFullscreen(false); if(watchId.current) navigator.geolocation.clearWatch(watchId.current); }} className="bg-white p-4 rounded-2xl shadow-2xl text-red-500 border border-slate-100"><XCircle size={26} /></button>
            <div className="flex-1 bg-white/95 backdrop-blur px-5 py-3 rounded-2xl shadow-2xl flex flex-col justify-center border border-slate-100">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Repartiendo a</p>
              <p className="text-xs font-black text-slate-800 truncate uppercase italic">{clientes.find(c => c.id === verMapa)?.nombre}</p>
            </div>
          </div>
          <MapContainer center={[posicionActual.lat, posicionActual.lng]} zoom={17} zoomControl={false} className="flex-1 w-full">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={[posicionActual.lat, posicionActual.lng]} icon={iconoRepartidor} />
            <MotorLogistico origen={posicionActual} direccionDestino={clientes.find(c => c.id === verMapa)?.direccion} />
          </MapContainer>
          <div className="p-6 bg-white border-t-2 border-slate-100"><button onClick={() => setMapaFullscreen(false)} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-xs">Cerrar Navegación</button></div>
        </div>
      )}

      {/* PREVIEW FOTO */}
      {fotoPreview && (
        <div className="fixed inset-0 z-[2000] bg-slate-900/90 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white w-full max-w-sm rounded-[3rem] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 bg-slate-50 border-b flex justify-between items-center"><span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Evidencia de Entrega</span><XCircle onClick={() => setFotoPreview(null)} className="text-slate-300 cursor-pointer"/></div>
            <img src={fotoPreview} className="h-64 object-cover" alt="Preview" />
            <div className="p-8">
              <h4 className="text-xl font-black text-slate-800 text-center uppercase italic mb-6">Confirmar Folio #{pedidoActivo?.folio}</h4>
              <button disabled={subiendo} onClick={subirEntrega} className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black uppercase shadow-xl">{subiendo ? "Sincronizando..." : "Finalizar Entrega"}</button>
              <button onClick={() => { setFotoPreview(null); fileRef.current.click(); }} className="w-full mt-4 text-indigo-600 font-bold text-xs uppercase underline">Repetir Fotografía</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() { return ( <Routes><Route path="/" element={<ContenedorPedidos />} /><Route path="*" element={<div className="h-screen flex items-center justify-center font-black text-slate-200 text-6xl italic uppercase tracking-tighter">ERROR 404</div>} /></Routes> ); }