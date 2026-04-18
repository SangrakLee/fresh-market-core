<script setup>
const detailImageModules = import.meta.glob('../assets/images/detail-img/*.{jpg,jpeg,png,webp}', {
  eager: true,
  import: 'default',
})

const detailImagePaths = Object.values(detailImageModules).sort()
</script>

<template>
  <div class="min-h-screen bg-white px-6 pt-3 pb-24">
    <div class="mx-auto flex max-w-[430px] flex-col gap-3">
      <img
        v-for="(detailImagePath, index) in detailImagePaths"
        :key="`${detailImagePath}-${index}`"
        :src="detailImagePath"
        :alt="`상세 페이지 이미지 ${index + 1}`"
        class="w-full rounded-lg"
      />
    </div>
  </div>
</template>
