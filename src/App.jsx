import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { MapPin, Clock, Calendar, User, ChevronDown, ChevronUp, Navigation, CheckCircle } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

export default function DriverDashboard() {
  const [pedidos, setPedidos] = useState([]);
  const [expandido, setExpandido] = useState(null);
  const [driverPos, setDriverPos] = useState([-29.95, -71.33]); // Coquimbo por defecto

  useEffect(() => {
    fetchPedidos();
    // Obtener ubicación real del Driver
    navigator.geolocation.getCurrentPosition((pos) => {
      setDriverPos([pos.coords.latitude, pos.coords.longitude]);
    });
  }, []);

  async function fetchPedidos() {
    const { data } = await supabase.from('pedidos').select('*').order('created_at', { ascending: false });
    setPedidos(data || []);
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 font-sans">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Rutas de Entrega</h1>
        <p className="text-gray-500">Hoy: {new Date().toLocaleDateString('es-CL')}</p>
      </header>

      <div className="space-y-4">
        {pedidos.map((p) => (
          <div key={p.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
            {/* VISTA RÁPIDA */}
            <div className="p-4 flex justify-between items-center" onClick={() => setExpandido(expandido === p.id ? null : p.id)}>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">#{p.folio}</span>
                  <span className="text-gray-400 text-xs flex items-center gap-1"><Clock size={12}/> {p.hora_entrega}</span>
                </div>
                <h3 className="font-bold text-gray-900">{p.nombre_cliente}</h3>
                <p className="text-sm text-gray-500 flex items-center gap-1"><MapPin size={14}/> {p.direccion_cliente}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-green-600">${Number(p.total).toLocaleString('es-CL')}</p>
                <button className="text-gray-400">
                  {expandido === p.id ? <ChevronUp /> : <ChevronDown />}
                </button>
              </div>
            </div>

            {/* VISTA DETALLADA (EXPANDIBLE) */}
            {expandido === p.id && (
              <div className="px-4 pb-4 border-t border-gray-50 bg-gray-50">
                <div className="py-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400 uppercase text-[10px] font-bold">Vendedor</p>
                    <p className="text-gray-700">{p.vendedor}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 uppercase text-[10px] font-bold">Producto</p>
                    <p className="text-gray-700">{p.producto} (x{p.cantidad})</p>
                  </div>
                </div>

                {/* MAPA EN TIEMPO REAL */}
                <div className="h-48 w-full rounded-lg overflow-hidden mb-4 border border-gray-300">
                  <MapContainer center={driverPos} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={driverPos}><Popup>Tu ubicación (Driver)</Popup></Marker>
                    {/* Nota: Aquí se necesitaría geocodificar la dirección del cliente para poner el segundo marcador */}
                  </MapContainer>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(p.direccion_cliente)}`)}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 active:scale-95 transition"
                  >
                    <Navigation size={18}/> Iniciar GPS
                  </button>
                  <button className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 active:scale-95 transition">
                    <CheckCircle size={18}/> Entregado
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}