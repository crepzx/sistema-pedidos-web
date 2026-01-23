import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Routes, Route, useParams } from 'react-router-dom';
import { 
  MapPin, Clock, Navigation, CheckCircle, 
  ChevronDown, ChevronUp, Package, UserCheck, 
  Search, AlertCircle, Phone // Añadido ícono de teléfono
} from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL, 
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function ContenedorPedidos() {
  const { nombreEmpresa } = useParams();
  const [clientesAgrupados, setClientesAgrupados] = useState([]);
  const [expandido, setExpandido] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (nombreEmpresa) fetchPedidos();
  }, [nombreEmpresa]);

  async function fetchPedidos() {
    setCargando(true);
    const empresaLimpia = decodeURIComponent(nombreEmpresa).trim();
    
    const { data, error } = await supabase
      .from('pedidos')
      .select('*, detalles_pedido!pedido_id(*)') 
      .ilike('empresa', empresaLimpia)
      .order('fecha', { ascending: false });

    if (error) {
      console.error("Error:", error.message);
    } else {
      // --- Lógica de Agrupamiento por RUT ---
      const agrupados = data.reduce((acc, current) => {
        const rut = current.rut_cliente || 'SIN-RUT';
        if (!acc[rut]) {
          acc[rut] = {
            nombre: current.nombre_cliente,
            rut: rut,
            direccion: current.direccion_cliente,
            telefono: current.telefono,
            pedidos: []
          };
        }
        acc[rut].pedidos.push(current);
        return acc;
      }, {});
      
      setClientesAgrupados(Object.values(agrupados));
    }
    setCargando(false);
  }

  async function confirmarEntrega(id, folio) {
    if (window.confirm(`¿Confirmar entrega del folio #${folio}?\nSe eliminará de la base de datos.`)) {
      const { error } = await supabase.from('pedidos').delete().eq('id', id);
      if (!error) {
        fetchPedidos();
      }
    }
  }

  // Validador de teléfono: Verifica que no esté vacío y tenga una longitud mínima
  const esTelefonoValido = (num) => num && num.replace(/\s/g, '').length >= 8;

  if (cargando) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-slate-500">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
        <p className="font-medium">Sincronizando pedidos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 md:p-10 font-sans text-slate-900">
      <div className="max-w-5xl mx-auto"> 
        <header className="mb-10 border-b border-slate-200 pb-6">
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-3">
            <Package className="text-blue-600" size={36} /> Rutas por Cliente
          </h1>
          <p className="text-slate-500 font-bold italic mt-2">
            Terminal: {decodeURIComponent(nombreEmpresa)}
          </p>
        </header>

        <main className="grid grid-cols-1 gap-6 pb-20">
          {clientesAgrupados.length === 0 ? (
            <div className="bg-white rounded-3xl p-16 text-center shadow-sm border border-slate-200">
              <Search size={50} className="mx-auto mb-4 text-slate-200" />
              <h3 className="text-xl font-bold text-slate-700">No hay despachos pendientes</h3>
            </div>
          ) : (
            clientesAgrupados.map((cliente) => (
              <div key={cliente.rut} className="w-full bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden">
                
                {/* CABECERA: Datos del Cliente */}
                <div className="p-6 md:p-8 cursor-pointer" onClick={() => setExpandido(expandido === cliente.rut ? null : cliente.rut)}>
                  <div className="flex justify-between items-start mb-4">
                    <span className="bg-slate-100 text-slate-600 text-xs font-black px-3 py-1 rounded-full">
                      RUT: {cliente.rut}
                    </span>
                    <div className="flex gap-2">
                      {esTelefonoValido(cliente.telefono) && (
                        <a 
                          href={`tel:${cliente.telefono}`} 
                          onClick={(e) => e.stopPropagation()} // Evita expandir la card al llamar
                          className="bg-emerald-100 text-emerald-700 p-2 rounded-full hover:bg-emerald-200 transition-colors"
                        >
                          <Phone size={20} />
                        </a>
                      )}
                      <div className="bg-blue-600 text-white text-xs font-black px-3 py-1 rounded-full flex items-center gap-1">
                        {cliente.pedidos.length} Pedido(s)
                      </div>
                    </div>
                  </div>
                  
                  <h2 className="text-2xl font-black text-slate-800 mb-2 uppercase italic">
                    {cliente.nombre}
                  </h2>
                  
                  <div className="flex items-start gap-2 text-slate-500">
                    <MapPin size={20} className="text-red-500 mt-1 shrink-0" />
                    <p className="text-sm font-medium">{cliente.direccion}</p>
                  </div>
                </div>

                {/* DETALLE: Lista de Pedidos/Folios */}
                {expandido === cliente.rut && (
                  <div className="bg-slate-50 p-4 md:p-8 border-t border-slate-100 animate-in fade-in duration-300">
                    <h4 className="text-xs font-black uppercase text-slate-400 mb-6 tracking-widest text-center">Gestión de Folios</h4>
                    
                    <div className="space-y-6">
                      {cliente.pedidos.map((p) => (
                        <div key={p.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                          {/* Info del Pedido */}
                          <div className="p-4 bg-slate-100 flex justify-between items-center border-b">
                            <span className="font-black text-blue-700">FOLIO #{p.folio}</span>
                            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                              <Clock size={14} /> {p.hora_entrega}
                            </span>
                          </div>

                          {/* Productos del Pedido */}
                          <div className="p-4 space-y-2">
                            {p.detalles_pedido?.map((det, idx) => (
                              <div key={idx} className="flex justify-between text-sm border-b border-slate-50 pb-1">
                                <span className="text-slate-700 font-medium">{det.descripcion}</span>
                                <span className="font-bold">x{det.cantidad}</span>
                              </div>
                            ))}
                            <div className="pt-2 flex justify-between items-end">
                              <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">Total Folio</p>
                                <p className="text-xl font-black text-emerald-600">${Number(p.total_pedido).toLocaleString('es-CL')}</p>
                              </div>
                              <button 
                                onClick={() => confirmarEntrega(p.id, p.folio)}
                                className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-emerald-700 transition"
                              >
                                <CheckCircle size={16}/> Confirmar Folio
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Acciones del Cliente */}
                    <div className="mt-8">
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cliente.direccion)}`}
                        target="_blank" rel="noreferrer"
                        className="w-full bg-slate-800 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-900 transition shadow-lg"
                      >
                        <Navigation size={22}/> Ir a la Ubicación (GPS)
                      </a>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </main>
      </div>
    </div>
  );
}

// (Componentes de Rutas e InfoBox se mantienen igual...)
export default function App() {
  return (
    <Routes>
      <Route path="/:nombreEmpresa" element={<ContenedorPedidos />} />
      <Route path="/" element={<div className="p-20 text-center font-black">ACCESO RESTRINGIDO</div>} />
    </Routes>
  );
}

function InfoBox({ label, value }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
      <p className="text-[10px] uppercase font-black text-slate-400 mb-1 tracking-wider">{label}</p>
      <p className="text-sm font-bold text-slate-700 truncate">{value || 'No especificado'}</p>
    </div>
  );
}