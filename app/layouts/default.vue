<template>
  <div class="flex h-screen w-full overflow-hidden bg-muted text-default">
    <PortalSidebar />
    <div class="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
      <slot />
    </div>
  </div>
</template>
