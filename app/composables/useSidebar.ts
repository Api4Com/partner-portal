// Estado (recolhida/expandida) do menu lateral, persistido entre sessões.
const STORAGE_KEY = 'portal:sidebar-collapsed'

export function useSidebar() {
  const collapsed = useState('sidebar-collapsed', () => false)

  onMounted(() => {
    collapsed.value = localStorage.getItem(STORAGE_KEY) === '1'
  })

  function toggle() {
    collapsed.value = !collapsed.value
    localStorage.setItem(STORAGE_KEY, collapsed.value ? '1' : '0')
  }

  return { collapsed, toggle }
}
