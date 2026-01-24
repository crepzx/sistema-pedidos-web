import React, { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Routes, Route } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';

import { 
  MapPin, Clock, Navigation, CheckCircle, 
  ChevronDown, ChevronUp, Package, UserCheck, 
  Phone, XCircle, Camera, RotateCcw, 
  Minimize2, Navigation2, ShoppingBag
} from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL, 
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// --- 1. CONFIGURACIÓN DE ICONOS ---
const iconoRepartidor = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
    iconSize: [40, 40], iconAnchor: [20, 40]
});

const iconoCliente = new L.Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/1219/1219321.png',
    iconSize: [42, 42], iconAnchor: [21, 42]
});

// --- 2. MOTOR LÓGICO DEL MAPA (FIX IPHONE & GEOCODING) ---
function MotorLogistico({ origen, direccionDestino }) {
  const map = useMap();
  const routingControlRef = useRef(null);
  const [coordsDestino, setCoordsDestino] = useState(null);

  // Buscar coordenadas una sola vez al cargar el destino
  useEffect(() => {
    if (!direccionDestino) return;
    
    const buscarCoordenadas = async () => {
      try {
        const limpia = direccionDestino.replace(/[#]/g, '');
        const query = encodeURIComponent(`${limpia}, Coquimbo, Chile`);
        
        // Fetch directo para evitar bloqueos de la librería geocoder
        const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`, {
            headers: { 'Accept-Language': 'es' }
        });
        const data = await response.json();

        if (data && data[0]) {
          setCoordsDestino({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        }
      } catch (e) {
        console.error("Error buscando dirección:", e);
      }
    };
    buscarCoordenadas();
  }, [direccionDestino]);

  // Manejar la ruta y el centrado
  useEffect(() => {
    if (!map || !origen || !coordsDestino) return;

    // Reparar visualización inicial
    setTimeout(() => { map.invalidateSize(); }, 500);

    if (!routingControlRef.current) {
      // Crear el control de ruta por primera vez
      routingControlRef.current = L.Routing.control({
        waypoints: [
          L.latLng(origen.lat, origen.lng),
          L.latLng(coordsDestino.lat, coordsDestino.lng)
        ],
        router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
        lineOptions: { styles: [{ color: '#4f46e5', weight: 8, opacity: 0.8 }] },
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: false,
        show: false, // Oculta panel de instrucciones
        createMarker: () => null,
        containerClassName: 'hidden', // Elimina icono parpadeante en iPhone
      }).addTo(map);
    } else {
      // Actualizar waypoints sin destruir el objeto (Fluidez total)
      routingControlRef.current.setWaypoints([
        L.latLng(origen.lat, origen.lng),
        L.latLng(coordsDestino.lat, coordsDestino.lng)
      ]);
    }

    // Seguir al repartidor
    map.panTo([origen.lat, origen.lng]);

  }, [origen, coordsDestino, map]);

  return coordsDestino ? <Marker position={[coordsDestino.lat, coordsDestino.lng]} icon={iconoCliente} /> : null;
}

// --- 3. COMPONENTE PRINCIPAL ---
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
  const ultimaPosicionRef = useRef({ lat: 0, lng: 0 });

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
    
    if (watchId.current) navigator.geolocation.clearWatch(watchId.current);

    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const nLat = p.coords.latitude;
        const nLng = p.coords.longitude;
        
        // Filtro de movimiento: 5 metros
        const actual = L.latLng(nLat, nLng);
        const anterior = L.latLng(ultimaPosicionRef.current.lat, ultimaPosicionRef.current.lng);
        
        if (actual.distanceTo(anterior) > 5) {
          ultimaPosicionRef.current = { lat: nLat, lng: nLng };
          setPosicionActual({ lat: nLat, lng: nLng });
        }
      },
      () => alert("Error GPS"),
      { enableHighAccuracy: true, maximumAge: 0 }
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
      const fileName = `entrega_${pedidoActivo.folio}_${Date.now()}.jpg`;
      await supabase.storage.from('evidencias').upload(`public/${fileName}`, blob);
      const { data: url } = supabase.storage.from('evidencias').getPublicUrl(`public/${fileName}`);
      await supabase.from('pedidos').update({ estado_entregado: true, url_foto: url.publicUrl }).eq('id', pedidoActivo.id);
      setFotoPreview(null); fetchData();
    } catch (e) { alert("Error"); }
    setSubiendo(false);
  };

  if (cargando) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
      <RotateCcw className="animate-spin mb-4 text-indigo-400" size={48} />
      <span className="font-black text-xl italic uppercase tracking-widest">Sincronizando...</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <input type="file" accept="image/*" capture="environment" ref={fileRef} className="hidden" onChange={handleFoto} />
      
      {/* HEADER DISEÑADO */}
      <header className="bg-slate-900 text-white p-7 shadow-2xl rounded-b-[3.5rem] mb-10">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black italic tracking-tighter uppercase flex items-center gap-2">
              <ShoppingBag className="text-indigo-400" /> POS Delivery
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Operaciones Coquimbo</p>
          </div>
          <button onClick={fetchData} className="bg-white/10 p-3 rounded-2xl active:scale-90 transition-all border border-white/5">
            <RotateCcw size={22} className="text-indigo-400" />
          </button>
        </div>
      </header>

      {/* CARDS PRINCIPALES */}
      <main className="max-w-4xl mx-auto px-5 space-y-6">
        {clientes.map((c) => {
          const isOpen = expandido === c.id;
          return (
            <div key={c.id} className={`bg-white rounded-[2.5rem] shadow-xl overflow-hidden border-2 transition-all duration-500 ${isOpen ? 'border-indigo-500 ring-8 ring-indigo-50' : 'border-transparent'}`}>
              <div className="p-7 cursor-pointer" onClick={() => setExpandido(isOpen ? null : c.id)}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full"><Package size={14} /><span className="text-[10px] font-black uppercase tracking-wider">Cliente</span></div>
                  {c.pedidos[0].telefono && <a href={`tel:${c.pedidos[0].telefono}`} onClick={e => e.stopPropagation()} className="bg-emerald-500 text-white p-3 rounded-2xl shadow-lg active:scale-90 transition-transform"><Phone size={20}/></a>}
                </div>
                <h2 className="text-3xl font-black text-slate-800 uppercase italic leading-none mb-3">{c.nombre}</h2>
                <div className="flex items-start gap-2 text-slate-500 mb-8 font-bold"><MapPin size={18} className="text-indigo-500 shrink-0 mt-0.5"/><p className="text-sm leading-tight uppercase">{c.direccion}</p></div>
                <div className="flex justify-between items-end pt-6 border-t border-slate-50">
                  <div><p className="text-[10px] text-slate-400 font-black uppercase mb-1">Monto Total</p><p className="text-3xl font-black text-indigo-600 tracking-tighter">${c.total.toLocaleString('es-CL')}</p></div>
                  <div className="flex items-center gap-3"><div className="text-right"><p className="text-[10px] font-black text-slate-800 uppercase">{c.pedidos.length} ITEMS</p></div><div className="bg-slate-50 p-2 rounded-full text-slate-300">{isOpen ? <ChevronUp size={28}/> : <ChevronDown size={28}/>}</div></div>
                </div>
              </div>

              {/* DETALLE DE PEDIDOS (HIJOS) */}
              {isOpen && (
                <div className="bg-slate-50 p-6 space-y-6 border-t border-slate-100 animate-in slide-in-from-top-4">
                  <div className="grid gap-5">
                    {c.pedidos.map((p) => (
                      <div key={p.id} className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                        {/* CABECERA Y PRODUCTOS (ANCHO COMPLETO) */}
                        <div className="p-6">
                          <div className="flex items-center gap-2 mb-4">
                            <span className="bg-slate-900 text-white text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-widest italic">Folio # {p.folio}</span>
                            <span className="text-slate-400 text-[10px] font-bold tracking-tighter flex items-center gap-1"><Clock size={12}/> {p.hora_entrega || 'Pendiente'}</span>
                          </div>
                          
                          <div className="space-y-2">
                            {p.detalles_pedido?.map((det, idx) => (
                              <div key={idx} className="flex justify-between items-center text-xs font-bold text-slate-600 uppercase bg-slate-50/50 p-3 rounded-xl border border-dashed border-slate-200">
                                <span className="flex-1 pr-4">{det.descripcion}</span>
                                <span className="text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100 shrink-0">x{det.cantidad}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* BOTÓN DE CAMARA AL FONDO DE LA TARRETA */}
                        <div className="bg-indigo-50/50 p-4 border-t border-slate-100">
                            <button 
                                onClick={() => { setPedidoActivo(p); fileRef.current.click(); }} 
                                className="w-full bg-white text-indigo-600 py-3 rounded-2xl border-2 border-indigo-100 font-black uppercase text-[10px] flex items-center justify-center gap-3 shadow-sm active:scale-95 active:bg-indigo-600 active:text-white transition-all"
                            >
                                <Camera size={20}/> Validar con Fotografía
                            </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* BOTÓN GPS INDEPENDIENTE */}
                  <button onClick={() => handleGPS(c.id)} className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black uppercase text-xs shadow-2xl flex items-center justify-center gap-3 active:scale-95 transition-all border-b-4 border-slate-700">
                    <Navigation2 size={20}/> Iniciar Ruta GPS (OSM)
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </main>

      {/* MAPA FULLSCREEN */}
      {mapaFullscreen && posicionActual && (
        <div className="fixed inset-0 z-[1000] bg-white flex flex-col overflow-hidden">
          <div className="absolute top-6 left-4 right-4 z-[1100] flex gap-3">
            <button onClick={() => { setMapaFullscreen(false); if(watchId.current) navigator.geolocation.clearWatch(watchId.current); }} className="bg-white p-4 rounded-2xl shadow-2xl text-red-500 border border-slate-100 active:scale-90 transition-transform"><XCircle size={28} /></button>
            <div className="flex-1 bg-white/95 backdrop-blur px-6 py-3 rounded-2xl shadow-2xl border border-slate-100 flex flex-col justify-center">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Repartiendo a</p>
              <p className="text-sm font-black text-slate-800 truncate uppercase italic">{clientes.find(c => c.id === verMapa)?.nombre}</p>
            </div>
          </div>
          
          <div className="flex-1 w-full h-full">
            <MapContainer center={[posicionActual.lat, posicionActual.lng]} zoom={17} zoomControl={false} className="w-full h-full">
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[posicionActual.lat, posicionActual.lng]} icon={iconoRepartidor} />
              <MotorLogistico origen={posicionActual} direccionDestino={clientes.find(c => c.id === verMapa)?.direccion} />
            </MapContainer>
          </div>

          <div className="p-6 bg-slate-900"><button onClick={() => setMapaFullscreen(false)} className="w-full bg-white/10 text-white py-4 rounded-2xl font-black uppercase text-[10px] border border-white/10">Detener GPS</button></div>
        </div>
      )}

      {/* MODAL FOTO VALIDACIÓN */}
      {fotoPreview && (
        <div className="fixed inset-0 z-[2000] bg-slate-900/95 flex items-center justify-center p-5 backdrop-blur-xl">
          <div className="bg-white w-full max-w-sm rounded-[3.5rem] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-5 bg-slate-50 border-b flex justify-between items-center">
                <span className="text-[11px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2"><UserCheck size={16}/> Evidencia de Entrega</span>
                <XCircle onClick={() => setFotoPreview(null)} className="text-slate-300 cursor-pointer" size={24}/>
            </div>
            <div className="relative">
                <img src={fotoPreview} className="h-80 w-full object-cover" alt="Preview" />
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur text-white px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">Vista Previa</div>
            </div>
            <div className="p-10">
              <h4 className="text-2xl font-black text-slate-800 text-center uppercase italic mb-8 tracking-tighter">¿Confirmar Folio #{pedidoActivo?.folio}?</h4>
              <button disabled={subiendo} onClick={subirEntrega} className="w-full bg-emerald-600 text-white py-6 rounded-[2rem] font-black uppercase shadow-2xl shadow-emerald-200 active:scale-95 transition-all text-sm">{subiendo ? "Subiendo Datos..." : "SI, CONFIRMAR ENTREGA"}</button>
              <button onClick={() => { setFotoPreview(null); fileRef.current.click(); }} className="w-full mt-6 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-indigo-600 transition-colors">Volver a tomar foto</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() { 
    return ( 
        <Routes>
            <Route path="/" element={<ContenedorPedidos />} />
            <Route path="*" element={<div className="h-screen flex items-center justify-center font-black text-slate-200 text-6xl italic uppercase">404</div>} />
        </Routes> 
    ); 
}