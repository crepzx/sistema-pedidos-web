import React, { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Routes, Route } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
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

/* ================= ICONOS ================= */

const iconoRepartidor = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40]
});

const iconoCliente = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/1219/1219321.png',
  iconSize: [42, 42],
  iconAnchor: [21, 42]
});

/* ================= MOTOR LOGÍSTICO ================= */

function MotorLogistico({ origen, direccionDestino }) {
  const map = useMap();
  const routingRef = useRef(null);
  const destinoRef = useRef(null);
  const [destino, setDestino] = useState(null);

  /* 🔥 FIX 1: el mapa sigue al repartidor */
  useEffect(() => {
    if (origen && map) {
      const zoomActual = map.getZoom();
      map.setView([origen.lat, origen.lng], zoomActual, { animate: true });
    }
  }, [origen, map]);

  /* 🔥 FIX 2: geocodificar SOLO la dirección (sin agregar Coquimbo) */
  useEffect(() => {
    if (!map || !origen || !direccionDestino) return;

    const geocoder = L.Control.Geocoder.nominatim();
    const direccionLimpia = direccionDestino.replace('#', '');

    geocoder.geocode(direccionLimpia, (res) => {
      if (!res || res.length === 0) return;

      const dest = res[0].center;

      // Evitar recalcular si no cambia
      if (
        destinoRef.current &&
        destinoRef.current.lat === dest.lat &&
        destinoRef.current.lng === dest.lng
      ) return;

      destinoRef.current = dest;
      setDestino(dest);

      if (routingRef.current) {
        map.removeControl(routingRef.current);
      }

      routingRef.current = L.Routing.control({
        waypoints: [
          L.latLng(origen.lat, origen.lng),
          L.latLng(dest.lat, dest.lng)
        ],
        router: L.Routing.osrmv1({
          serviceUrl: 'https://router.project-osrm.org/route/v1'
        }),
        addWaypoints: false,
        draggableWaypoints: false,
        fitSelectedRoutes: false,
        show: false,
        lineOptions: {
          styles: [{ color: '#6366f1', weight: 8, opacity: 0.9 }]
        },
        createMarker: () => null
      }).addTo(map);
    });

    return () => {
      if (routingRef.current) map.removeControl(routingRef.current);
    };
  }, [direccionDestino, map]);

  return destino ? (
    <Marker position={[destino.lat, destino.lng]} icon={iconoCliente} />
  ) : null;
}

/* ================= COMPONENTE PRINCIPAL ================= */

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
    return () => {
      if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  async function fetchData() {
    setCargando(true);

    const { data, error } = await supabase
      .from('pedidos')
      .select('*, detalles_pedido!pedido_id(*)')
      .eq('estado_entregado', false)
      .order('fecha_entrega', { ascending: true });

    if (!error) {
      const agrupados = data.reduce((acc, curr) => {
        const id = curr.rut_cliente || curr.nombre_cliente;
        if (!acc[id]) {
          acc[id] = {
            id,
            nombre: curr.nombre_cliente,
            direccion: curr.direccion_cliente,
            pedidos: [],
            total: 0
          };
        }
        acc[id].pedidos.push(curr);
        acc[id].total += Number(curr.total_pedido);
        return acc;
      }, {});
      setClientes(Object.values(agrupados));
    }

    setCargando(false);
  }

  /* ================= GPS ================= */

  const handleGPS = (id) => {
    setVerMapa(id);
    setMapaFullscreen(true);

    if (watchId.current) navigator.geolocation.clearWatch(watchId.current);

    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        setPosicionActual({
          lat: p.coords.latitude,
          lng: p.coords.longitude
        });
      },
      () => alert("Por favor activa el GPS"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  /* ================= FOTO ENTREGA ================= */

  const handleFoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => setFotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const subirEntrega = async () => {
    setSubiendo(true);

    try {
      const blob = await fetch(fotoPreview).then(r => r.blob());
      const fileName = `pos_${pedidoActivo.folio}_${Date.now()}.jpg`;

      await supabase.storage
        .from('evidencias')
        .upload(`public/${fileName}`, blob);

      const { data: url } = supabase.storage
        .from('evidencias')
        .getPublicUrl(`public/${fileName}`);

      await supabase
        .from('pedidos')
        .update({
          estado_entregado: true,
          url_foto: url.publicUrl
        })
        .eq('id', pedidoActivo.id);

      setFotoPreview(null);
      setPedidoActivo(null);
      fetchData();

    } catch {
      alert("Error al subir evidencia");
    }

    setSubiendo(false);
  };

  if (cargando) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900 text-white font-black text-2xl animate-pulse italic uppercase">
        Conectando Sistema Logístico...
      </div>
    );
  }

  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-slate-50 pb-10 font-sans">
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileRef}
        className="hidden"
        onChange={handleFoto}
      />

      {/* HEADER */}
      <header className="bg-slate-900 text-white p-6 shadow-2xl rounded-b-[2.5rem] mb-8">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-black italic tracking-tighter uppercase flex items-center gap-2">
              <ShoppingBag className="text-indigo-400" size={24} /> POS Delivery
            </h1>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
              Coquimbo, Chile
            </p>
          </div>
          <button
            onClick={fetchData}
            className="bg-white/10 p-3 rounded-2xl active:scale-90"
          >
            <RotateCcw size={20} className="text-indigo-400" />
          </button>
        </div>
      </header>

      {/* LISTADO */}
      <main className="max-w-4xl mx-auto px-4 space-y-5">
        {clientes.map((c) => {
          const isOpen = expandido === c.id;

          return (
            <div key={c.id} className="bg-white rounded-[2rem] shadow-xl overflow-hidden">
              <div
                className="p-6 cursor-pointer"
                onClick={() => setExpandido(isOpen ? null : c.id)}
              >
                <h2 className="text-2xl font-black uppercase italic">{c.nombre}</h2>
                <p className="text-xs flex items-center gap-1 uppercase">
                  <MapPin size={14} /> {c.direccion}
                </p>
              </div>

              {isOpen && (
                <div className="p-5">
                  <button
                    onClick={() => handleGPS(c.id)}
                    className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-3"
                  >
                    <Navigation2 size={18} /> Iniciar Ruta OSM
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </main>

      {/* MAPA FULLSCREEN */}
      {mapaFullscreen && posicionActual && (
        <div className="fixed inset-0 z-[1000] bg-white">
          <MapContainer
            center={[posicionActual.lat, posicionActual.lng]}
            zoom={17}
            zoomControl={false}
            className="w-full h-full"
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={[posicionActual.lat, posicionActual.lng]} icon={iconoRepartidor} />
            <MotorLogistico
              origen={posicionActual}
              direccionDestino={clientes.find(c => c.id === verMapa)?.direccion}
            />
          </MapContainer>
        </div>
      )}
    </div>
  );
}

/* ================= ROUTER ================= */

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ContenedorPedidos />} />
      <Route
        path="*"
        element={
          <div className="h-screen flex items-center justify-center font-black text-slate-200 text-6xl italic uppercase">
            404
          </div>
        }
      />
    </Routes>
  );
}
