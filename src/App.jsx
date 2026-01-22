import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Routes, Route, useParams } from 'react-router-dom';
import { 
  MapPin, Clock, Navigation, CheckCircle, 
  ChevronDown, ChevronUp, Package, UserCheck, 
  Search, AlertCircle 
} from 'lucide-react';

// Inicialización de Supabase con variables de entorno
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL, 
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function ContenedorPedidos() {
  const { nombreEmpresa } = useParams();
  const [pedidos, setPedidos] = useState([]);
  const [expandido, setExpandido] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (nombreEmpresa) {
      fetchPedidos();
    }
  }, [nombreEmpresa]);

  async function fetchPedidos() {
    setCargando(true);
    const empresaLimpia = decodeURIComponent(nombreEmpresa).trim();
    
    // Consulta Master-Detail: Un pedido tiene muchos productos
    const { data, error } = await supabase
      .from('pedidos')
      .select('*, detalles_pedido!pedido_id(*)') 
      .ilike('empresa', empresaLimpia)
      .order('fecha', { ascending: false }); // Ordenado por columna fecha

    if (error) console.error("Error:", error.message);
    else setPedidos(data || []);
    setCargando(false);
  }

  async function confirmarEntrega(id, folio) {
    if (window.confirm(`¿Confirmar entrega del pedido #${folio}?\nSe eliminará de la base de datos.`)) {
      const { error } = await supabase.from('pedidos').delete().eq('id', id);
      if (!error) {
        alert("Pedido entregado correctamente.");
        fetchPedidos();
        setExpandido(null);
      }
    }
  }

  if (cargando) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-slate-500">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4"></div>
        <p className="font-medium">Sincronizando con Supabase...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 md:p-10 font-sans text-slate-900">
      {/* Contenedor Principal Centrado y más ancho */}
      <div className="max-w-5xl mx-auto"> 
        <header className="mb-10 text-center md:text-left border-b border-slate-200 pb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 tracking-tight flex items-center justify-center md:justify-start gap-3">
            <Package className="text-blue-600 shrink-0" size={36} /> Rutas de Entrega
          </h1>
          <p className="text-slate-500 font-bold italic mt-2 text-sm md:text-base">
            Terminal de Despacho: {decodeURIComponent(nombreEmpresa)}
          </p>
        </header>

        <main className="grid grid-cols-1 gap-6 pb-20">
          {pedidos.length === 0 ? (
            <div className="bg-white rounded-3xl p-16 text-center shadow-sm border border-slate-200">
              <Search size={50} className="mx-auto mb-4 text-slate-200" />
              <h3 className="text-xl font-bold text-slate-700">No hay despachos pendientes</h3>
              <p className="text-slate-400 text-sm mt-2">Los pedidos enviados desde C# aparecerán aquí.</p>
            </div>
          ) : (
            pedidos.map((p) => (
              <div key={p.id} className="w-full bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden hover:border-blue-300 transition-colors">
                
                {/* CABECERA DE LA TARJETA */}
                <div className="p-6 md:p-8 cursor-pointer w-full" onClick={() => setExpandido(expandido === p.id ? null : p.id)}>
                  <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
                    <span className="bg-blue-600 text-white text-xs font-black px-4 py-1 rounded-full italic shadow-sm">
                      FOLIO #{p.folio}
                    </span>
                    <span className="text-slate-400 text-xs font-bold flex items-center gap-1">
                      <Clock size={16} /> PROGRAMADO: {p.hora_entrega || '--:--'}
                    </span>
                  </div>
                  
                  <h2 className="text-2xl font-black text-slate-800 mb-2 leading-tight break-words uppercase">
                    {p.nombre_cliente}
                  </h2>
                  
                  <div className="flex items-start gap-2 text-slate-500 mb-6">
                    <MapPin size={20} className="text-red-500 mt-1 shrink-0" />
                    <p className="text-sm md:text-base font-medium leading-relaxed break-words">
                      {p.direccion_cliente}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-blue-600 text-xs font-black uppercase mb-6 bg-blue-50 w-fit px-3 py-1 rounded-lg">
                    <Package size={16} />
                    <span>Contenido: {p.detalles_pedido?.length || 0} productos únicos</span>
                  </div>

                  <div className="pt-6 border-t border-slate-100 flex justify-between items-center w-full">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total a Cobrar</span>
                      <span className="text-3xl font-black text-emerald-600">
                        ${Number(p.total_pedido).toLocaleString('es-CL')}
                      </span>
                    </div>
                    <div className="bg-slate-100 p-3 rounded-full text-slate-500 hover:bg-blue-100 hover:text-blue-600 transition-colors">
                      {expandido === p.id ? <ChevronUp size={24}/> : <ChevronDown size={24}/>}
                    </div>
                  </div>
                </div>

                {/* DETALLE EXPANDIDO CON SCROLL [UX OPTIMIZADO] */}
                {expandido === p.id && (
                  <div className="bg-slate-50 p-6 md:p-8 border-t border-slate-100 w-full animate-in fade-in duration-300">
                    <h4 className="text-xs font-black uppercase text-slate-400 mb-4 tracking-widest text-center">Desglose de Productos</h4>
                    
                    <div className="space-y-3 mb-8 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                      {p.detalles_pedido?.map((item, index) => (
                        <div key={index} className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-800 text-sm md:text-base truncate">{item.descripcion}</p>
                            <p className="text-[10px] md:text-xs text-slate-500 font-bold uppercase">
                              {item.cantidad} {item.unidad_medida} × ${Number(item.precio_unitario).toLocaleString('es-CL')}
                            </p>
                          </div>
                          <p className="font-black text-slate-700 text-sm md:text-base shrink-0">
                            ${Number(item.subtotal).toLocaleString('es-CL')}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Información adicional en Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                      <InfoBox label="Ejecutivo de Venta" value={p.vendedor} />
                      <InfoBox label="Fecha del Documento" value={p.fecha_entrega} />
                      <div className="col-span-1 sm:col-span-2 bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-4 shadow-sm">
                        <UserCheck size={24} className="text-blue-500 shrink-0"/>
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase font-black text-slate-400">Punto de Contacto / Recibe:</p>
                          <p className="text-sm md:text-base font-bold text-slate-700 truncate">
                            {p.quien_recibe || 'Encargado de Local'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* ACCIONES PRINCIPALES */}
                    <div className="flex flex-col sm:flex-row gap-4 w-full">
                      <a 
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.direccion_cliente)}`}
                        target="_blank" rel="noreferrer"
                        className="flex-1 bg-slate-800 text-white py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 active:scale-95 transition shadow-lg hover:bg-slate-900"
                      >
                        <Navigation size={22}/> Abrir Navegador
                      </a>
                      <button 
                        onClick={() => confirmarEntrega(p.id, p.folio)}
                        className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-3 active:scale-95 transition shadow-lg hover:bg-emerald-700"
                      >
                        <CheckCircle size={22}/> Confirmar Entrega
                      </button>
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

// --- ENRUTAMIENTO DINÁMICO ---
export default function App() {
  return (
    <Routes>
      <Route path="/:nombreEmpresa" element={<ContenedorPedidos />} />
      <Route path="/" element={
        <div className="min-h-screen flex items-center justify-center bg-slate-100 p-8 text-center font-sans">
          <div className="bg-white p-12 rounded-[40px] shadow-2xl max-w-md border border-slate-200">
            <AlertCircle size={60} className="mx-auto text-amber-500 mb-6" />
            <h2 className="text-2xl font-black text-slate-800 mb-3">Acceso Restringido</h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              Debe ingresar a través de la URL personalizada proporcionada por su sistema central.
            </p>
          </div>
        </div>
      } />
    </Routes>
  );
}

function InfoBox({ label, value }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm min-w-0">
      <p className="text-[10px] uppercase font-black text-slate-400 mb-1 truncate tracking-wider">{label}</p>
      <p className="text-sm font-bold text-slate-700 truncate">{value || 'No especificado'}</p>
    </div>
  );
}