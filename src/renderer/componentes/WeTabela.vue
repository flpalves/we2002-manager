<template>
  <div class="we-tabela">
    <table class="we-table"><slot /></table>
  </div>
</template>

<style scoped>
.we-tabela {
  overflow-x: auto;
}
.we-tabela :deep(th) {
  position: sticky;
  top: 0;
}
</style>
