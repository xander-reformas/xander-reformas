import { useState, useEffect } from 'react'
import { useAuth } from './useAuth'
import { supabase } from '../lib/supabase'

// Determina si la sesión activa corresponde a un cliente del Portal (no a un
// profesional) y, si lo es, carga su ficha de cliente (clientes.portal_user_id).
// Distinguimos "cliente de portal" de "profesional" por esta relación, no por
// la tabla profiles: el trigger on_auth_user_created crea una fila en profiles
// para CUALQUIER usuario nuevo (también los del portal), así que profiles no
// sirve para diferenciar el rol.
export function usePortalCliente() {
  const { user, loading: authLoading } = useAuth()
  const [cliente, setCliente] = useState(null)
  const [esCliente, setEsCliente] = useState(null) // null = comprobando todavía
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) { setEsCliente(false); setCliente(null); setLoading(false); return }
    let cancelado = false
    setLoading(true)
    supabase
      .from('clientes')
      .select('*')
      .eq('portal_user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelado) return
        setCliente(data || null)
        setEsCliente(!!data)
        setLoading(false)
      })
    return () => { cancelado = true }
  }, [user, authLoading])

  return { cliente, esCliente, loading: authLoading || loading }
}
